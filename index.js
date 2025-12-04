const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
// CRITICAL FOR RENDER: Must use process.env.PORT
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'database.json');

// Middleware
// Allow requests from anywhere (for now) to solve connection issues
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json({ limit: '50mb' }));

// Initialize Data
let db = {
    users: [],
    admins: [{ id: 'admin', password: 'admin', name: 'Administrator' }]
};

// Load existing data if file exists
if (fs.existsSync(DB_FILE)) {
    try {
        const fileData = fs.readFileSync(DB_FILE, 'utf8');
        db = JSON.parse(fileData);
    } catch (err) {
        console.error('Error reading database file:', err);
    }
} else {
    // Create file if it doesn't exist
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Helper to save data
const saveData = () => {
    // On Render Free Tier, this file resets on deployment, but persists while running
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
};

// --- ROUTES ---

// Health Check (To verify server is running on Render)
app.get('/', (req, res) => {
    res.send('Salon Backend is Running!');
});

// Login
app.post('/api/login', (req, res) => {
    const { id, password, role } = req.body;
    console.log(`Login attempt: ${id} (${role})`);

    if (role === 'admin') {
        const admin = db.admins.find(a => a.id === id && a.password === password);
        if (admin) {
            res.json({ success: true, user: { id: admin.id, name: admin.name, role: 'admin' } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid Admin credentials' });
        }
    } else {
        const user = db.users.find(u => (u.applicationNumber === id || u.id === id) && u.password === password);
        if (user) {
            const { password, ...userWithoutPass } = user;
            res.json({ success: true, user: userWithoutPass });
        } else {
            res.status(401).json({ success: false, message: 'Invalid Candidate credentials' });
        }
    }
});

// Register
app.post('/api/register', (req, res) => {
    const { applicationNumber, password, role } = req.body;

    if (role === 'admin') {
        if (db.admins.find(a => a.id === applicationNumber)) {
            return res.status(400).json({ success: false, message: 'Admin ID already exists' });
        }
        db.admins.push({ id: applicationNumber, password, name: 'Admin ' + applicationNumber });
        saveData();
        res.json({ success: true });
    } else {
        if (db.users.find(u => u.applicationNumber === applicationNumber)) {
            return res.status(400).json({ success: false, message: 'Application number already registered' });
        }
        
        const newUser = {
            id: 'u_' + Date.now(),
            applicationNumber,
            password,
            name: 'Candidate ' + applicationNumber,
            joinedAt: Date.now(),
            completedTechniques: [],
            customerSessions: []
        };
        
        db.users.push(newUser);
        saveData();
        res.json({ success: true, userId: newUser.id });
    }
});

// Reset Password
app.post('/api/reset-password', (req, res) => {
    const { id, newPassword, role } = req.body;
    
    if (role === 'admin') {
        const admin = db.admins.find(a => a.id === id);
        if (admin) {
            admin.password = newPassword;
            saveData();
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'Admin ID not found' });
        }
    } else {
        const user = db.users.find(u => u.applicationNumber === id || u.id === id);
        if (user) {
            user.password = newPassword;
            saveData();
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'Candidate not found' });
        }
    }
});

// Get Users
app.get('/api/users', (req, res) => {
    const safeUsers = db.users.map(({ password, ...u }) => u);
    res.json(safeUsers);
});

// Get Single User
app.get('/api/users/:id', (req, res) => {
    const user = db.users.find(u => u.id === req.params.id);
    if (user) {
        const { password, ...safeUser } = user;
        res.json(safeUser);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
});

// Save Progress
app.post('/api/training/complete', (req, res) => {
    const { userId, techniqueData } = req.body;
    const user = db.users.find(u => u.id === userId);
    
    if (user) {
        user.completedTechniques.push(techniqueData);
        saveData();
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'User not found' });
    }
});

// Save Session
app.post('/api/session/complete', (req, res) => {
    const { userId, sessionData } = req.body;
    const user = db.users.find(u => u.id === userId);
    
    if (user) {
        user.customerSessions.push(sessionData);
        saveData();
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'User not found' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});