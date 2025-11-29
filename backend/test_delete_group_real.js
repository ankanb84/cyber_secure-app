require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('./src/models/Group');
const GroupMessage = require('./src/models/GroupMessage');

async function testDeleteGroup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const groupId = '692a0d5c513b2554ce9f8555'; // The ID of 'busy'
        console.log(`Attempting to delete group ID: "${groupId}"`);

        const group = await Group.findById(groupId);
        if (!group) {
            console.log('Group not found (404)');
            process.exit(0);
        }

        console.log(`Found group: ${group.name}, Creator: ${group.creatorId}`);

        // Simulate deletion logic
        await GroupMessage.deleteMany({ groupId });
        await Group.findByIdAndDelete(groupId);
        console.log('Group deleted successfully');

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testDeleteGroup();
