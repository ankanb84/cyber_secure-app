require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('./src/models/Group');

async function testFindGroup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const groupId = '692a0d5c513b2554ce9f8555';
        console.log(`Searching for group ID: "${groupId}"`);

        const group = await Group.findById(groupId);
        console.log('Result:', group);

        if (group) {
            console.log('Group found:', group.name);
        } else {
            console.log('Group NOT found');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testFindGroup();
