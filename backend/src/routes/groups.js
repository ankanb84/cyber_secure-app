const express = require('express');
const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');
const User = require('../models/User');

const router = express.Router();

// Create a new group
router.post('/', async (req, res) => {
  try {
    const { name, description, avatar, memberIds } = req.body;
    const creatorId = req.user.userId;

    if (!name || !memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'Group name and at least one member required' });
    }

    // Verify all members exist
    const members = await User.find({ _id: { $in: memberIds } });
    if (members.length !== memberIds.length) {
      return res.status(400).json({ error: 'Some members not found' });
    }

    console.log('Creating group request body:', req.body);
    console.log('Creator ID from token:', creatorId, 'Type:', typeof creatorId);

    // Ensure creator is in the members list
    const memberIdSet = new Set(memberIds.map(id => id.toString()));
    memberIdSet.add(creatorId.toString());
    const uniqueMemberIds = Array.from(memberIdSet);

    console.log('Unique Member IDs to be saved:', uniqueMemberIds);

    // Create group with members (keys will be updated by frontend)
    const group = new Group({
      name,
      description: description || '',
      avatar: avatar || null,
      creatorId,
      members: uniqueMemberIds.map(memberId => ({
        userId: memberId,
        role: memberId === creatorId ? 'admin' : 'member',
        encryptedGroupKey: 'pending', // Will be set by frontend
        ephemeralPublicKey: 'pending',
        keyNonce: 'pending'
      }))
    });

    await group.save();
    await group.populate('members.userId', 'name username profilePicture');
    await group.populate('creatorId', 'name username profilePicture');

    const io = req.app.get('io');
    // Notify all members
    uniqueMemberIds.forEach(memberId => {
      io.to(memberId.toString()).emit('group_created', group);
    });

    res.status(201).json(group);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Update group (add/remove members, rotate keys)
router.patch('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, avatar, addMembers, removeMembers, rotateKey } = req.body;
    const userId = req.user.userId;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Check if user is admin or creator
    const isAdmin = group.creatorId.toString() === userId ||
      group.members.some(m => m.userId.toString() === userId && m.role === 'admin');
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can modify group' });
    }

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (avatar !== undefined) group.avatar = avatar;

    // Add members
    if (addMembers && Array.isArray(addMembers)) {
      const newMembers = await User.find({ _id: { $in: addMembers } });
      newMembers.forEach(member => {
        if (!group.members.some(m => m.userId.toString() === member._id.toString())) {
          group.members.push({
            userId: member._id,
            role: 'member',
            encryptedGroupKey: '', // Will be set by frontend
            ephemeralPublicKey: '',
            keyNonce: ''
          });
        }
      });
    }

    // Remove members
    if (removeMembers && Array.isArray(removeMembers)) {
      group.members = group.members.filter(m => !removeMembers.includes(m.userId.toString()));
    }

    // Rotate group key
    if (rotateKey) {
      group.groupKeyVersion += 1;
      group.lastKeyRotation = new Date();
      // Frontend will update encrypted keys for all members
    }

    // Update member keys if provided
    if (req.body.members && Array.isArray(req.body.members)) {
      req.body.members.forEach(updatedMember => {
        const memberIndex = group.members.findIndex(m =>
          m.userId.toString() === updatedMember.userId
        );
        if (memberIndex !== -1) {
          group.members[memberIndex].encryptedGroupKey = updatedMember.encryptedGroupKey;
          group.members[memberIndex].ephemeralPublicKey = updatedMember.ephemeralPublicKey;
          group.members[memberIndex].keyNonce = updatedMember.keyNonce;
        }
      });
    }

    group.updatedAt = new Date();
    await group.save();
    await group.populate('members.userId', 'name username profilePicture');

    const io = req.app.get('io');
    group.members.forEach(member => {
      io.to(member.userId.toString()).emit('group_updated', group);
    });

    res.json(group);
  } catch (err) {
    console.error('Update group error:', err);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Get user's groups
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const groups = await Group.find({
      'members.userId': userId
    })
      .populate('members.userId', 'name username profilePicture')
      .populate('creatorId', 'name username profilePicture')
      .sort({ updatedAt: -1 });

    res.json(groups);
  } catch (err) {
    console.error('Get groups error:', err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get single group
router.get('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    const group = await Group.findOne({
      _id: groupId,
      'members.userId': userId
    })
      .populate('members.userId', 'name username profilePicture')
      .populate('creatorId', 'name username profilePicture');

    if (!group) return res.status(404).json({ error: 'Group not found' });

    res.json(group);
  } catch (err) {
    console.error('Get group error:', err);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Send message to group
router.post('/:groupId/messages', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { encryptedContent, nonce, messageNumber, messageType } = req.body;
    const senderId = req.user.userId;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Verify user is a member
    const isMember = group.members.some(m => m.userId.toString() === senderId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a group member' });
    }

    const message = new GroupMessage({
      groupId,
      senderId,
      encryptedContent,
      nonce,
      messageNumber,
      messageType: messageType || 'text'
    });

    await message.save();
    await message.populate('senderId', 'name username profilePicture');

    const io = req.app.get('io');
    // Notify all group members
    group.members.forEach(member => {
      if (member.userId.toString() !== senderId) {
        io.to(member.userId.toString()).emit('new_group_message', message);
      }
    });

    res.status(201).json(message);
  } catch (err) {
    console.error('Send group message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get group messages
router.get('/:groupId/messages', async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = group.members.some(m => m.userId.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a group member' });
    }

    const messages = await GroupMessage.find({
      groupId,
      deleted: false
    })
      .populate('senderId', 'name username profilePicture')
      .sort({ timestamp: 1 })
      .limit(100);

    // Mark as read
    await GroupMessage.updateMany(
      {
        groupId,
        'readBy.userId': { $ne: userId }
      },
      {
        $push: {
          readBy: {
            userId,
            readAt: new Date()
          }
        }
      }
    );

    res.json(messages);
  } catch (err) {
    console.error('Get group messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Leave group
router.post('/:groupId/leave', async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Creator cannot leave
    if (group.creatorId.toString() === userId) {
      return res.status(400).json({ error: 'Creator cannot leave group' });
    }

    group.members = group.members.filter(m => m.userId.toString() !== userId);
    await group.save();

    const io = req.app.get('io');
    group.members.forEach(member => {
      io.to(member.userId.toString()).emit('group_updated', group);
    });
    io.to(userId).emit('group_left', { groupId });

    res.json({ message: 'Left group successfully' });
  } catch (err) {
    console.error('Leave group error:', err);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// Delete group
router.delete('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Only creator can delete
    console.log(`Delete Group Request: Group ${group._id}, Creator ${group.creatorId}, RequestUser ${userId}`);

    if (group.creatorId.toString() !== userId) {
      console.log('Delete failed: User is not creator');
      return res.status(403).json({ error: 'Only creator can delete group' });
    }

    // Delete all messages
    await GroupMessage.deleteMany({ groupId });

    // Delete group
    await Group.findByIdAndDelete(groupId);
    console.log(`Group ${groupId} deleted from DB`);

    const io = req.app.get('io');
    group.members.forEach(member => {
      io.to(member.userId.toString()).emit('group_left', { groupId });
    });

    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

module.exports = router;

