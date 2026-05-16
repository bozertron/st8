# Watchdog Protocol

A background process that supervises wave agents and alerts the orchestrator when an agent is hung, overtime, or making no progress. Distilled from the 31-wave sprint where one agent (Wave 3C executor) hung silently and stalled the entire pipeline.

## What it watches for

Three independent trigger signals — any one fires an alarm:

| Signal | Threshold | Catches |
|---|---|---|
| `STALE_WRITES` | uncommitted files unchanged >15 min | Agent dies mid-edit |
| `AGENT_OVERTIME` | wall-clock since launch >2× declared budget | Agent stuck in long subprocess or read/think loop |
| `NO_COMMIT_PROGRESS` | active >20 min AND zero new commits AND zero uncommitted | Agent silently looping with no observable output (the 3C-style hang) |

The 3rd signal is the one that caught the gap: the original watchdog v1 only watched `STALE_WRITES`, so an agent that had committed everything and then hung silently after went undetected. v2 added the wall-clock signals.

## State file convention

Before launching every agent, the orchestrator writes:
```bash
cat > /tmp/st8-active-agent.txt <<EOF
agent_id=<from Agent tool response>
description=Wave <N> <executor|reviewer> — <topic>
launched_at=$(date +%s)
budget_min=<declared budget>
EOF
```

After agent completion (or abort), the orchestrator either:
- Updates the file for the next agent, OR
- `rm /tmp/st8-active-agent.txt` if no agent is in flight

The watchdog reads this file each tick. No agent file → no agent → only emit heartbeats.

## The script (v2.1 — D-entry false-alarm fixed)

```bash
cd /home/user/st8 && \
STATE_FILE=/tmp/st8-active-agent.txt && \
PREV_TRIGGER="" && \
LAST_HB=$(date +%s) && \
PREV_COMMITS=$(git rev-list --count HEAD 2>/dev/null) && \
echo "WATCHDOG: v2.1 armed" && \
while true; do
  NOW=$(date +%s)
  UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
  COMMITS=$(git rev-list --count HEAD 2>/dev/null)

  # Read agent state
  AGENT_ID=""
  LAUNCHED_AT=""
  BUDGET_MIN=""
  ACTIVE_MIN=0
  if [ -f "$STATE_FILE" ]; then
    AGENT_ID=$(grep -E "^agent_id=" "$STATE_FILE" | cut -d= -f2-)
    LAUNCHED_AT=$(grep -E "^launched_at=" "$STATE_FILE" | cut -d= -f2-)
    BUDGET_MIN=$(grep -E "^budget_min=" "$STATE_FILE" | cut -d= -f2-)
    [ -n "$LAUNCHED_AT" ] && ACTIVE_MIN=$(( (NOW - LAUNCHED_AT) / 60 ))
  fi

  # Signal 1: STALE_WRITES — uncommitted files with old mtime
  # (v2.1: skip 'D ' deleted-staged entries — stat fails on nonexistent files)
  STALE_TRIGGER=""
  if [ "$UNCOMMITTED" -gt 0 ]; then
    OLDEST=$(git status --porcelain 2>/dev/null | grep -v "^D " | \
             awk '{print $NF}' | \
             while read f; do [ -e "$f" ] && stat -c '%Y' "$f" 2>/dev/null; done | \
             sort -n | head -1)
    if [ -n "$OLDEST" ] && [ "$OLDEST" -gt 0 ]; then
      AGE_SEC=$((NOW - OLDEST))
      [ "$AGE_SEC" -gt 900 ] && STALE_TRIGGER="STALE_WRITES age_min=$((AGE_SEC/60))"
    fi
  fi

  # Signal 2: AGENT_OVERTIME
  OVERTIME_TRIGGER=""
  if [ -n "$LAUNCHED_AT" ] && [ -n "$BUDGET_MIN" ]; then
    HARD_LIMIT=$((BUDGET_MIN * 2))
    [ "$ACTIVE_MIN" -gt "$HARD_LIMIT" ] && \
      OVERTIME_TRIGGER="AGENT_OVERTIME active=${ACTIVE_MIN}m budget=${BUDGET_MIN}m"
  fi

  # Signal 3: NO_COMMIT_PROGRESS — active >20m AND zero writes AND zero commits
  NO_PROGRESS_TRIGGER=""
  if [ -n "$LAUNCHED_AT" ] && [ "$ACTIVE_MIN" -gt 20 ]; then
    COMMITS_DELTA=$((COMMITS - PREV_COMMITS))
    [ "$COMMITS_DELTA" -eq 0 ] && [ "$UNCOMMITTED" -eq 0 ] && \
      NO_PROGRESS_TRIGGER="NO_COMMIT_PROGRESS active=${ACTIVE_MIN}m"
  fi

  # Emit transition events only — not every cycle
  CURRENT_TRIGGER="${STALE_TRIGGER}${OVERTIME_TRIGGER}${NO_PROGRESS_TRIGGER}"
  if [ -n "$CURRENT_TRIGGER" ] && [ "$CURRENT_TRIGGER" != "$PREV_TRIGGER" ]; then
    echo "WATCHDOG ALARM agent=${AGENT_ID:-none} active=${ACTIVE_MIN}m triggers=[$STALE_TRIGGER | $OVERTIME_TRIGGER | $NO_PROGRESS_TRIGGER]"
    PREV_TRIGGER="$CURRENT_TRIGGER"
  fi
  if [ -z "$CURRENT_TRIGGER" ] && [ -n "$PREV_TRIGGER" ]; then
    echo "WATCHDOG OK resumed"
    PREV_TRIGGER=""
  fi

  # Heartbeat every 25 minutes
  if [ $((NOW - LAST_HB)) -gt 1500 ]; then
    echo "WATCHDOG HB agent=${AGENT_ID:-none} active=${ACTIVE_MIN}m budget=${BUDGET_MIN:-?}m uncommitted=$UNCOMMITTED commits=$COMMITS"
    LAST_HB=$NOW
  fi

  # Progress event on each new commit (visibility, not alarm)
  if [ "$COMMITS" != "$PREV_COMMITS" ] && [ -n "$LAUNCHED_AT" ]; then
    echo "WATCHDOG PROGRESS agent=${AGENT_ID} commits ${PREV_COMMITS}→${COMMITS} active=${ACTIVE_MIN}m"
    PREV_COMMITS=$COMMITS
  fi

  sleep 60
done
```

## How to launch

Use the orchestrator's `Monitor` tool with `persistent: true` and `timeout_ms: 3600000` (1 hour — though the Monitor framework caps the displayed timeout at 30 min and the orchestrator re-arms when it expires).

```
Monitor({
  description: "st8 sprint watchdog v2.1",
  command: "<the script above>",
  persistent: true,
  timeout_ms: 3600000
})
```

## When the watchdog alarms

| Trigger | Likely cause | Typical response |
|---|---|---|
| `STALE_WRITES` >15min | Agent hung mid-edit (subprocess deadlock or read/think stall) | Investigate uncommitted state. If clearly stuck, abort + relaunch with tighter scope. |
| `AGENT_OVERTIME` >2× budget | Agent took longer than expected; check committed progress | If commits are landing, give 5 more min; if no commits AND no writes, treat as `NO_COMMIT_PROGRESS`. |
| `NO_COMMIT_PROGRESS` >20min | Silent infinite loop (the 3C pattern). Agent has no observable output. | Almost always means abort + relaunch. The work-so-far is in WIP commit (orchestrator commits whatever was committed plus any uncommitted state as `wip(wave-<N>): aborted mid-run`). Relaunch with shrunk scope referencing the WIP commit. |

## Lessons that produced this protocol

- **Wave 3C executor hung for 35+ min** in a no-timeout `curl http://localhost/api/identity-risk` after the `node start.js &` failed to bind a port. The work was done; the agent just couldn't recover from the failed subprocess. → Added the `AGENT_OVERTIME` signal.
- **Wave 3C re-launch hung from minute 1** with zero file writes — purely stuck in a read/think loop before any edits. → Added the `NO_COMMIT_PROGRESS` signal.
- **Wave 6B's mid-delete state** triggered a 56-year-old false alarm because `stat -c '%Y'` returned empty on deleted-staged files (`D ` git status entries). → v2.1 skips `D ` entries before computing oldest mtime.

## Re-arming after Monitor timeout

The Monitor framework caps `persistent: true` runs at ~30 minutes per launch. The orchestrator should re-arm the watchdog each time the previous one emits `[Monitor timed out — re-arm if needed.]`. State file persists across re-arms, so agent tracking is continuous.
