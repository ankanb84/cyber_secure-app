require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('./src/models/Group');

async function fixMissingCreators() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const groups = await Group.find({});
        console.log(`Checking ${groups.length} groups...`);

        for (const g of groups) {
            const creatorIdStr = g.creatorId.toString();
            const isCreatorMember = g.members.some(m => m.userId.toString() === creatorIdStr);

            if (!isCreatorMember) {
                console.log(`Fixing group "${g.name}" (${g._id}): Adding creator ${creatorIdStr} to members.`);
                g.members.push({
                    userId: g.creatorId,
                    role: 'admin',
                    encryptedGroupKey: 'pending',
                    ephemeralPublicKey: 'pending',
                    keyNonce: 'pending'
                });
                await g.save();
                console.log('Saved.');
            } else {
                console.log(`Group "${g.name}" is OK.`);
            }
        }

        console.log('Done.');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fixMissingCreators();
