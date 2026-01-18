const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const seedAdmin = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("Connected.");

        const email = process.env.FIXED_ADMIN_USERNAME || 'admin@admin.com';
        const password = process.env.FIXED_ADMIN_PASSWORD || 'admin123';

        console.log(`Seeding admin user: ${email}`);

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const adminData = {
            email,
            password: hashedPassword,
            username: 'Admin',
            isAdmin: true,
            hasCompletedOnboarding: true,
            profile: {
                name: 'Administrator',
                college: 'System',
                universityNumber: '0000',
                degreeType: 'System',
                branch: 'System',
                year: 'System',
                learningStyle: 'System',
                currentGoals: 'Maintain System'
            }
        };

        const result = await User.findOneAndUpdate(
            { email },
            adminData,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log("Admin user seeded successfully:");
        console.log(result);

        process.exit(0);
    } catch (error) {
        console.error("Error seeding admin:", error);
        process.exit(1);
    }
};

seedAdmin();
