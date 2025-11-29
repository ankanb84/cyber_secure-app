require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('./src/models/Group');
const User = require('./src/models/User');

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(async () => {
        console.log('Connected to MongoDB');

        const groups = await Group.find({});

        for (const group of groups) {
            const creatorIdStr = group.creatorId.toString();
            const isCreatorMember = group.members.some(m => m.userId.toString() === creatorIdStr);

            if (!isCreatorMember) {
                console.log(`Fixing group ${group.name}: Adding creator ${creatorIdStr} to members`);

                group.members.push({
                    userId: group.creatorId,
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

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
