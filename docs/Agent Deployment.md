1. Prompts should be Specific and Information Dense

Always specify: "Verify against actual codebase before claiming"
Always require: "Run grep/verification commands before modifying documents"
Always include: "If uncertain, report uncertainty — do not guess" , File Paths, 
Integration Points, Potential Risks, and CRITICALLY = Wire Every Component and 
Test the Signal Path before the job can be considered finished. 

2. Add Verification Steps

Before any document edit, require a verification agent to check the claim
Add a "confidence threshold" — don't modify if confidence < HIGH

3. Increase Agent Density for Critical Tasks

For document edits: 1 researcher + 1 verifier (minimum)
For code changes: 1 researcher + 1 planner + 1 executor + 1 verifier
Never trust a single agent for critical document modifications
