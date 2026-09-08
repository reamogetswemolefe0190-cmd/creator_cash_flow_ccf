#!/usr/bin/env node
/* ==========================================================================
   Creator Cash Flow - Link Validation Script
   Automatically checks for broken links in HTML and JavaScript files
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const FILES_TO_CHECK = ['index.html', 'admin.html', 'app.js', 'server.js'];
const EXTERNAL_TIMEOUT = 10000; // 10 seconds for external link checks
const SKIP_EXTERNAL_CHECKS = process.env.SKIP_EXTERNAL === 'true';

// Results tracking
const results = {
    internalLinks: [],
    externalLinks: [],
    fileReferences: [],
    errors: []
};

// ANSI color codes for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

// Extract all href and src attributes from content
function extractLinks(content, filePath) {
    const links = [];
    
    // Extract href attributes with their rel attribute context
    const hrefRegex = /<link[^>]*href=["']([^"']+)["'][^>]*>/g;
    let match;
    while ((match = hrefRegex.exec(content)) !== null) {
        const relMatch = match[0].match(/rel=["']([^"']+)["']/);
        const rel = relMatch ? relMatch[1] : null;
        
        links.push({
            type: 'href',
            url: match[1],
            rel: rel,
            filePath,
            line: getLineNumber(content, match.index)
        });
    }
    
    // Extract anchor href attributes
    const anchorRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/g;
    while ((match = anchorRegex.exec(content)) !== null) {
        links.push({
            type: 'anchor',
            url: match[1],
            filePath,
            line: getLineNumber(content, match.index)
        });
    }
    
    // Extract src attributes
    const srcRegex = /src=["']([^"']+)["']/g;
    while ((match = srcRegex.exec(content)) !== null) {
        links.push({
            type: 'src',
            url: match[1],
            filePath,
            line: getLineNumber(content, match.index)
        });
    }
    
    // Extract HTTP/HTTPS URLs in JavaScript
    const urlRegex = /https?:\/\/[^\s"'`]+/g;
    while ((match = urlRegex.exec(content)) !== null) {
        links.push({
            type: 'url',
            url: match[0],
            filePath,
            line: getLineNumber(content, match.index)
        });
    }
    
    return links;
}

function getLineNumber(content, index) {
    const lines = content.substring(0, index).split('\n');
    return lines.length;
}

// Check if a file exists locally
function checkFileExists(filePath, link) {
    const basePath = path.dirname(filePath);
    const fullPath = path.join(basePath, link.url);
    
    if (fs.existsSync(fullPath)) {
        results.fileReferences.push({
            status: 'valid',
            file: link.url,
            fullPath,
            filePath,
            line: link.line
        });
        return true;
    } else {
        results.fileReferences.push({
            status: 'broken',
            file: link.url,
            fullPath,
            filePath,
            line: link.line
        });
        return false;
    }
}

// Check anchor link targets in HTML
function checkAnchorLinks(content, filePath) {
    const anchorRegex = /href=["']#([^"']+)["']/g;
    const anchorLinks = [];
    let match;
    
    while ((match = anchorRegex.exec(content)) !== null) {
        const targetId = match[1];
        const line = getLineNumber(content, match.index);
        
        // Check if the target ID exists in the file
        const idRegex = new RegExp(`id=["']${targetId}["']`, 'g');
        const idExists = idRegex.test(content);
        
        results.internalLinks.push({
            target: targetId,
            status: idExists ? 'valid' : 'broken',
            filePath,
            line
        });
        
        if (!idExists) {
            log(`❌ Broken anchor link: #${targetId} in ${filePath}:${line}`, colors.red);
        }
    }
}

// Check external URL availability
function checkExternalUrl(url) {
    return new Promise((resolve) => {
        const isHttps = url.startsWith('https://');
        const client = isHttps ? https : http;
        
        try {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'HEAD',
                timeout: EXTERNAL_TIMEOUT
            };
            
            const req = client.request(options, (res) => {
                resolve({
                    url,
                    status: res.statusCode,
                    valid: res.statusCode >= 200 && res.statusCode < 400
                });
            });
            
            req.on('error', (error) => {
                resolve({
                    url,
                    status: 'ERROR',
                    valid: false,
                    error: error.message
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                resolve({
                    url,
                    status: 'TIMEOUT',
                    valid: false,
                    error: 'Request timeout'
                });
            });
            
            req.end();
        } catch (error) {
            resolve({
                url,
                status: 'INVALID',
                valid: false,
                error: error.message
            });
        }
    });
}

// Main validation function
async function validateLinks() {
    log('🔍 Starting link validation...', colors.cyan);
    log('=' .repeat(50), colors.cyan);
    
    for (const file of FILES_TO_CHECK) {
        const filePath = path.join(__dirname, file);
        
        if (!fs.existsSync(filePath)) {
            log(`⚠️  File not found: ${file}`, colors.yellow);
            continue;
        }
        
        log(`\n📄 Checking: ${file}`, colors.blue);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract all links
        const links = extractLinks(content, filePath);
        
        // Check anchor links if HTML file
        if (file.endsWith('.html')) {
            checkAnchorLinks(content, filePath);
        }
        
        // Categorize and check links
        for (const link of links) {
            if (link.url.startsWith('#')) {
                // Anchor link - already checked
                continue;
            } else if (link.url.startsWith('http://') || link.url.startsWith('https://')) {
                // Skip preconnect links (they're optimization hints, not actual links)
                if (link.rel === 'preconnect') {
                    continue;
                }
                // Skip DNS prefetch links
                if (link.rel === 'dns-prefetch') {
                    continue;
                }
                // Skip localhost and 127.0.0.1 links (development URLs)
                if (link.url.includes('localhost') || link.url.includes('127.0.0.1')) {
                    continue;
                }
                // Skip font domain base URLs (they're not actual resource links)
                if (link.url === 'https://fonts.googleapis.com' || link.url === 'https://fonts.gstatic.com') {
                    continue;
                }
                // Skip internal API endpoints that might not be publicly accessible
                if (link.url.includes('.onrender.com') || link.url.includes('.supabase.co') || link.url.includes('getphyllo.com') || link.url.includes('generativelanguage.googleapis.com')) {
                    results.externalLinks.push({
                        url: link.url,
                        filePath,
                        line: link.line,
                        status: 'skipped',
                        reason: 'API endpoint'
                    });
                    continue;
                }
                // External link
                if (!SKIP_EXTERNAL_CHECKS) {
                    results.externalLinks.push({
                        url: link.url,
                        filePath,
                        line: link.line,
                        status: 'pending'
                    });
                } else {
                    results.externalLinks.push({
                        url: link.url,
                        filePath,
                        line: link.line,
                        status: 'skipped'
                    });
                }
            } else if (!link.url.startsWith('data:') && !link.url.startsWith('mailto:')) {
                // Local file reference - remove query parameters
                const cleanUrl = link.url.split('?')[0];
                const cleanLink = { ...link, url: cleanUrl };
                checkFileExists(filePath, cleanLink);
            }
        }
    }
    
    // Check external links if not skipped
    if (!SKIP_EXTERNAL_CHECKS && results.externalLinks.length > 0) {
        log('\n🌐 Checking external links...', colors.cyan);
        
        const externalChecks = results.externalLinks
            .filter(link => link.status === 'pending')
            .map(link => checkExternalUrl(link.url));
        
        const externalResults = await Promise.all(externalChecks);
        
        // Update results
        externalResults.forEach(result => {
            const link = results.externalLinks.find(l => l.url === result.url);
            if (link) {
                link.status = result.valid ? 'valid' : 'broken';
                link.httpStatus = result.status;
                if (result.error) {
                    link.error = result.error;
                }
            }
        });
    }
    
    // Print results
    printResults();
}

function printResults() {
    log('\n' + '='.repeat(50), colors.cyan);
    log('📊 VALIDATION RESULTS', colors.cyan);
    log('='.repeat(50), colors.cyan);
    
    // Internal links (anchor links)
    const brokenInternal = results.internalLinks.filter(l => l.status === 'broken');
    const validInternal = results.internalLinks.filter(l => l.status === 'valid');
    
    log(`\n🔗 Internal Anchor Links:`, colors.blue);
    log(`   ✅ Valid: ${validInternal.length}`, colors.green);
    log(`   ❌ Broken: ${brokenInternal.length}`, brokenInternal.length > 0 ? colors.red : colors.green);
    
    if (brokenInternal.length > 0) {
        log('\n   Broken anchor links:', colors.red);
        brokenInternal.forEach(link => {
            log(`   - #${link.target} in ${link.filePath}:${link.line}`, colors.red);
        });
    }
    
    // File references
    const brokenFiles = results.fileReferences.filter(l => l.status === 'broken');
    const validFiles = results.fileReferences.filter(l => l.status === 'valid');
    
    log(`\n📁 File References:`, colors.blue);
    log(`   ✅ Valid: ${validFiles.length}`, colors.green);
    log(`   ❌ Broken: ${brokenFiles.length}`, brokenFiles.length > 0 ? colors.red : colors.green);
    
    if (brokenFiles.length > 0) {
        log('\n   Broken file references:', colors.red);
        brokenFiles.forEach(link => {
            log(`   - ${link.file} in ${link.filePath}:${link.line}`, colors.red);
        });
    }
    
    // External links
    const brokenExternal = results.externalLinks.filter(l => l.status === 'broken');
    const validExternal = results.externalLinks.filter(l => l.status === 'valid');
    const skippedExternal = results.externalLinks.filter(l => l.status === 'skipped');
    
    log(`\n🌐 External Links:`, colors.blue);
    log(`   ✅ Valid: ${validExternal.length}`, colors.green);
    log(`   ❌ Broken: ${brokenExternal.length}`, brokenExternal.length > 0 ? colors.red : colors.green);
    log(`   ⏭️  Skipped: ${skippedExternal.length}`, colors.yellow);
    
    if (brokenExternal.length > 0) {
        log('\n   Broken external links:', colors.red);
        brokenExternal.forEach(link => {
            log(`   - ${link.url} in ${link.filePath}:${link.line}`, colors.red);
            if (link.error) {
                log(`     Error: ${link.error}`, colors.red);
            }
        });
    }
    
    // Summary
    const totalBroken = brokenInternal.length + brokenFiles.length + brokenExternal.length;
    log('\n' + '='.repeat(50), colors.cyan);
    
    if (totalBroken === 0) {
        log('✅ All links are valid!', colors.green);
        process.exit(0);
    } else {
        log(`❌ Found ${totalBroken} broken link(s)`, colors.red);
        process.exit(1);
    }
}

// Run validation
validateLinks().catch(error => {
    log(`\n❌ Validation error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
});