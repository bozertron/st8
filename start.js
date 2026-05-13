#!/usr/bin/env node

/**
 * ST8 — Startup Script
 * 
 * Launches the ST8 backend server and opens the UI.
 * This is the main entry point for the application.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ─── CONFIGURATION ───────────────────────────────────────────

const CONFIG = {
    port: 3847,
    targetDir: process.argv[2] || process.cwd(),
    watchMode: process.argv.includes('--watch'),
    devMode: process.argv.includes('--dev'),
    openBrowser: !process.argv.includes('--no-browser')
};

// ─── MAIN ────────────────────────────────────────────────────

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ST8 — Full Stack Logic Analyzer                           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Target: ${CONFIG.targetDir}`);
    console.log(`Port:   ${CONFIG.port}`);
    console.log(`Watch:  ${CONFIG.watchMode ? 'enabled' : 'disabled'}`);
    console.log(`Dev:    ${CONFIG.devMode ? 'enabled' : 'disabled'}`);
    console.log('');

    // Check if target directory exists
    if (!fs.existsSync(CONFIG.targetDir)) {
        console.error(`Error: Target directory does not exist: ${CONFIG.targetDir}`);
        process.exit(1);
    }

    // Install dependencies if needed
    await installDependencies();

    // Start the backend server
    await startBackend();

    // Open browser if requested
    if (CONFIG.openBrowser) {
        openBrowser();
    }

    console.log('');
    console.log('ST8 is running!');
    console.log(`Backend API: http://localhost:${CONFIG.port}`);
    console.log(`Open st8.html in your browser to use the UI`);
    console.log('');
    console.log('Press Ctrl+C to stop');
}

// ─── INSTALL DEPENDENCIES ────────────────────────────────────

async function installDependencies() {
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    
    if (!fs.existsSync(nodeModulesPath)) {
        console.log('Installing dependencies...');
        
        return new Promise((resolve, reject) => {
            const npm = spawn('npm', ['install'], {
                cwd: __dirname,
                stdio: 'inherit',
                shell: true
            });
            
            npm.on('close', (code) => {
                if (code === 0) {
                    console.log('Dependencies installed successfully');
                    resolve();
                } else {
                    console.error('Failed to install dependencies');
                    reject(new Error('npm install failed'));
                }
            });
        });
    }
}

// ─── START BACKEND ───────────────────────────────────────────

async function startBackend() {
    console.log('Starting backend server...');
    
    const backendPath = path.join(__dirname, 'backend', 'index.js');
    
    const args = [
        CONFIG.targetDir,
        '--port', CONFIG.port
    ];
    
    if (CONFIG.watchMode) {
        args.push('--watch');
    }
    
    args.push('--serve');
    
    const backend = spawn('node', [backendPath, ...args], {
        cwd: __dirname,
        stdio: 'inherit',
        shell: true
    });
    
    backend.on('error', (err) => {
        console.error('Failed to start backend:', err.message);
    });
    
    backend.on('close', (code) => {
        console.log(`Backend exited with code ${code}`);
    });
    
    // Give the backend time to start
    await new Promise(resolve => setTimeout(resolve, 1000));
}

// ─── OPEN BROWSER ────────────────────────────────────────────

function openBrowser() {
    const url = `http://localhost:${CONFIG.port}`;
    
    // Try to open browser
    try {
        const open = require('open');
        open(url);
    } catch (err) {
        // Fallback: just log the URL
        console.log(`Open in browser: ${url}`);
    }
}

// ─── RUN ─────────────────────────────────────────────────────

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
