require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('./src/models/Group');
const User = require('./src/models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cyber_chat', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(async () => {
        console.log('Connected to MongoDB');

        const groups = await Group.find({})
            .populate('members.userId', 'username')
            .populate('creatorId', 'username');

        console.log(`Found ${groups.length} groups:`);
        groups.forEach(g => {
            console.log(`Group: ${g.name} (Creator: ${g.creatorId?.username})`);
            console.log(`Members (${g.members.length}):`);
            g.members.forEach(m => {
                console.log(` - ${m.userId?.username} (${m.role})`);
            });
            console.log('---');
        });

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
