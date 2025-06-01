// Script to add sample test data to localStorage for testing history loading
// Run this in the browser console

console.log('=== Adding Test History Data ===');

const testHistoryData = [
    {
        id: "test-item-1",
        text: "Hello, this is a test audio file.",
        settings: {
            provider: "openai",
            model: "tts-1",
            voice: "alloy"
        },
        result: {
            queryId: "query-123",
            status: "completed",
            audioData: [/* mock audio data as number array */],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            duration: 3.5,
            fileSize: 45000
        },
        createdAt: new Date().toISOString(),
        audioSize: 45000,
        metadata: {
            title: "Test Audio 1",
            tags: ["test", "sample"]
        }
    },
    {
        id: "test-item-2",
        text: "This is another test for history loading.",
        settings: {
            provider: "elevenlabs",
            model: "eleven_multilingual_v2",
            voice: "rachel"
        },
        result: {
            queryId: "query-456",
            status: "completed",
            audioData: [/* mock audio data */],
            createdAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
            updatedAt: new Date(Date.now() - 60000).toISOString(),
            duration: 2.8,
            fileSize: 38000
        },
        createdAt: new Date(Date.now() - 60000).toISOString(),
        audioSize: 38000,
        metadata: {
            title: "Test Audio 2",
            tags: ["test", "demo"]
        }
    }
];

try {
    localStorage.setItem('tts-history', JSON.stringify(testHistoryData));
    console.log('✓ Test history data added to localStorage');
    console.log('Added items:', testHistoryData.length);
    
    // Verify it was stored
    const stored = localStorage.getItem('tts-history');
    const parsed = JSON.parse(stored);
    console.log('✓ Verification: stored items count =', parsed.length);
    
} catch (error) {
    console.error('✗ Error adding test data:', error);
}

console.log('=== Test Data Setup Complete ===');
console.log('Now refresh the page to test history loading!');
