// Test script to verify metadata parsing logic
const fs = require('fs');
const path = require('path');

// Test the metadata parsing logic
function testMetadataParsing() {
    console.log('=== Testing Metadata Parsing Logic ===\n');
    
    // Test case 1: Direct array format (legacy)
    const directArrayFormat = [
        { id: '1', text: 'Test 1', provider: 'test' },
        { id: '2', text: 'Test 2', provider: 'test' }
    ];
    
    // Test case 2: Wrapped format (current)
    const wrappedFormat = {
        history: [
            { id: '1', text: 'Test 1', provider: 'test' },
            { id: '2', text: 'Test 2', provider: 'test' }
        ]
    };
    
    function parseMetadata(metadata) {
        let historyArray = null;
        
        if (Array.isArray(metadata)) {
            // Direct array format (legacy format)
            console.log(`Found direct array with ${metadata.length} items`);
            historyArray = metadata;
        } else if (metadata.history && Array.isArray(metadata.history)) {
            // Wrapped format with history property (current format)
            console.log(`Found wrapped format with ${metadata.history.length} items in metadata`);
            historyArray = metadata.history;
        } else {
            console.log('No valid history data found in metadata file');
        }
        
        return historyArray;
    }
    
    console.log('Test 1 - Direct array format:');
    const result1 = parseMetadata(directArrayFormat);
    console.log('Result:', result1?.length || 0, 'items\n');
    
    console.log('Test 2 - Wrapped format:');
    const result2 = parseMetadata(wrappedFormat);
    console.log('Result:', result2?.length || 0, 'items\n');
    
    // Test case 3: Load actual metadata file if it exists
    const metadataPath = path.join(__dirname, 'selected-folder', 'ai-tts-history-metadata.json');
    if (fs.existsSync(metadataPath)) {
        console.log('Test 3 - Actual metadata file:');
        try {
            const fileContent = fs.readFileSync(metadataPath, 'utf-8');
            const metadata = JSON.parse(fileContent);
            const result3 = parseMetadata(metadata);
            console.log('Result:', result3?.length || 0, 'items');
            console.log('First item preview:', result3?.[0] ? JSON.stringify(result3[0], null, 2).substring(0, 200) + '...' : 'none');
        } catch (error) {
            console.log('Error reading metadata file:', error.message);
        }
    } else {
        console.log('Test 3 - No actual metadata file found at:', metadataPath);
    }
}

testMetadataParsing();
