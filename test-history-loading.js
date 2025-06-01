// Test script to check localStorage content for history
// Run this in the browser console to check what's stored

console.log('=== TTS History Storage Test ===');

// Check localStorage content
const historyKey = 'tts-history';
const storedHistory = localStorage.getItem(historyKey);

console.log('1. Checking localStorage for history...');
console.log('Key:', historyKey);
console.log('Raw stored data:', storedHistory);

if (storedHistory) {
    try {
        const parsed = JSON.parse(storedHistory);
        console.log('2. Parsed history data:');
        console.log('Type:', typeof parsed);
        console.log('Is Array:', Array.isArray(parsed));
        console.log('Length:', parsed.length);
        
        if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('3. First item sample:');
            console.log(parsed[0]);
        }
    } catch (error) {
        console.error('2. Error parsing stored history:', error);
    }
} else {
    console.log('2. No history found in localStorage');
}

// Check for other TTS-related keys
console.log('\n3. Other TTS-related localStorage keys:');
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('tts')) {
        console.log(`${key}: ${localStorage.getItem(key)?.substring(0, 100)}...`);
    }
}

// Check current service state (if available)
if (typeof window !== 'undefined' && window.ng) {
    console.log('\n4. Checking Angular service state...');
    // This would need to be run in the actual app context
} else {
    console.log('\n4. Angular context not available in this environment');
}

console.log('=== End Test ===');
