const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['resident', 'technician', 'analyst', 'utility', 'admin'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  homeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Home',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);