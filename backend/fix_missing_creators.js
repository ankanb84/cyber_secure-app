require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('./src/models/Group');

async function fixGroups() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const groups = await Group.find({});
        console.log(`Found ${groups.length} groups`);

        for (const group of groups) {
            const creatorId = group.creatorId.toString();
            const isMember = group.members.some(m => m.userId.toString() === creatorId);

            if (!isMember) {
                console.log(`Fixing group ${group.name} (${group._id}): Adding creator ${creatorId} to members`);
                group.members.push({
                    userId: creatorId,
                    role: 'admin',
                    encryptedGroupKey: 'pending',
                    ephemeralPublicKey: 'pending',
                    keyNonce: 'pending'
                });
                await group.save();
                console.log('Fixed.');
            } else {
                console.log(`Group ${group.name} is fine.`);
            }
        }

        console.log('Done');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fixGroups();
