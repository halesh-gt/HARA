const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Global error handling for silent crashes
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './'))); 

// Serve the main portal at the root
app.get('/', (req, res) => {
  console.log('Root hit: serving job-portal.html');
  res.sendFile(path.join(__dirname, 'job-portal.html'));
});

// MySQL Connection Configuration
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Root', // Synchronized with user's updated password
  database: 'hara_db'
});

// Connect and Create Database/Tables
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    console.log('Attempting to create database...');

    // Try connecting without database to create it
    const tempDb = mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Root'
    });

    tempDb.query('CREATE DATABASE IF NOT EXISTS hara_db', (err) => {
      if (err) console.error('Could not create database:', err);
      else {
        console.log('Database hara_db created or exists. Please restart the server.');
        process.exit(0);
      }
    });
    return;
  }
  console.log('Connected to MySQL database.');

  // Create Tables
  const createOpeningsTable = `
    CREATE TABLE IF NOT EXISTS openings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(50),
      title VARCHAR(255),
      company VARCHAR(255),
      location VARCHAR(100),
      salary VARCHAR(100),
      req TEXT,
      tags TEXT,
      featured BOOLEAN DEFAULT FALSE,
      is_new BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createApplicationsTable = `
    CREATE TABLE IF NOT EXISTS applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      openingId INT,
      role VARCHAR(255),
      name VARCHAR(255),
      email VARCHAR(255),
      qualification VARCHAR(100),
      link TEXT,
      status VARCHAR(50) DEFAULT 'New',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createAdminsTable = `
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      password VARCHAR(255),
      phone VARCHAR(20),
      qualification VARCHAR(100),
      experience VARCHAR(50),
      link TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createCompaniesTable = `
    CREATE TABLE IF NOT EXISTS companies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      password VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createSubmissionsTable = `
    CREATE TABLE IF NOT EXISTS job_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT,
      company_name VARCHAR(255),
      type VARCHAR(50),
      title VARCHAR(255),
      location VARCHAR(100),
      salary VARCHAR(100),
      req TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createSiteContentTable = `
    CREATE TABLE IF NOT EXISTS site_content (
      content_key VARCHAR(100) PRIMARY KEY,
      content_value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

  db.query(createOpeningsTable, (err) => { if(err) console.error('Openings table error:', err); });
  db.query(createApplicationsTable, (err) => { if(err) console.error('Apps table error:', err); });
  
  db.query(createAdminsTable, (err) => { 
    if(err) console.error('Admins table error:', err);
    else {
      db.query('SELECT * FROM admins WHERE email = ?', ['admin@hara.com'], (err, results) => {
        if (!err && results.length === 0) {
          db.query('INSERT INTO admins (email, password) VALUES (?, ?)', ['admin@hara.com', 'admin123']);
          console.log('Default admin created: admin@hara.com / admin123');
        }
      });
    }
  });

  db.query(createSiteContentTable, (err) => {
    if(err) console.error('SiteContent table error:', err);
    else {
      const defaults = [
        ['hero_title_1', 'Best Career Growth Opportunities'],
        ['hero_subtitle_1', 'Connecting top talent with industry leaders.'],
        ['hero_img_1', 'hero_finanza.png'],
        ['hero_title_2', 'Find Your Dream Internship'],
        ['hero_subtitle_2', 'Step into the professional world with HARA.'],
        ['hero_img_2', 'hero_office_exterior.png'],
        ['about_title', 'We Help To Get The Best Job And Find A Talent'],
        ['about_desc', 'HARA is dedicated to connecting top talent with industry leaders. Our mission is to empower professionals to find their true calling.'],
        ['about_img', 'about_us.png'],
        ['stat_jobs_published', '1234'],
        ['stat_jobs_completed', '4567'],
        ['stat_clients', '890'],
        ['stat_awards', '123'],
        ['footer_about', 'Connect with industry leaders and find your next big opportunity with HARA. We provide the tools and support you need to excel in your career.'],
        ['footer_phone', '+012 345 67890'],
        ['footer_email', 'info@hara.com']
      ];
      defaults.forEach(([key, val]) => {
        db.query('INSERT IGNORE INTO site_content (content_key, content_value) VALUES (?, ?)', [key, val]);
      });
    }
  });

  db.query(createUsersTable, (err) => { 
    if(err) console.error('Users table creation error:', err);
    else {
      console.log('Users table ready. Checking columns...');
      db.query("SHOW COLUMNS FROM users", (err, results) => {
        if (err) return console.error('Migration check error:', err);
        const existingColumns = results.map(r => r.Field);
        const required = ['phone', 'experience', 'link'];
        required.forEach(col => {
          if (!existingColumns.includes(col)) {
            let sql = '';
            if (col === 'phone') sql = "ALTER TABLE users ADD COLUMN phone VARCHAR(20) AFTER password";
            if (col === 'experience') sql = "ALTER TABLE users ADD COLUMN experience VARCHAR(50) AFTER qualification";
            if (col === 'link') sql = "ALTER TABLE users ADD COLUMN link TEXT AFTER experience";
            db.query(sql, (err) => {
              if (err) console.error(`Failed to add column ${col}:`, err.message);
              else console.log(`Column ${col} added successfully.`);
            });
          }
        });
      });
    }
  });

  db.query(createCompaniesTable, (err) => { if(err) console.error('Companies table error:', err); });
  db.query(createSubmissionsTable, (err) => { if(err) console.error('Submissions table error:', err); });
});

// API Routes

// Get all openings
app.get('/api/openings', (req, res) => {
  db.query('SELECT * FROM openings ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).send(err);
    // Parse tags JSON string back to array
    const openings = results.map(op => ({
      ...op,
      tags: op.tags ? JSON.parse(op.tags) : []
    }));
    res.json(openings);
  });
});

// Post new opening
app.post('/api/openings', (req, res) => {
  const { type, title, company, location, salary, req: requirement, tags, featured } = req.body;
  const sql = 'INSERT INTO openings (type, title, company, location, salary, req, tags, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(sql, [type, title, company, location, salary, requirement, JSON.stringify(tags || []), featured || false], (err, result) => {
    if (err) return res.status(500).send(err);
    res.json({ id: result.insertId, ...req.body });
  });
});

// Delete opening
app.delete('/api/openings/:id', (req, res) => {
  db.query('DELETE FROM openings WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).send(err);
    res.json({ message: 'Deleted successfully' });
  });
});

// Get all applications
app.get('/api/applications', (req, res) => {
  db.query('SELECT * FROM applications ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// Submit application
app.post('/api/applications', (req, res) => {
  const { openingId, role, name, email, qualification, link } = req.body;
  const sql = 'INSERT INTO applications (openingId, role, name, email, qualification, link) VALUES (?, ?, ?, ?, ?, ?)';
  db.query(sql, [openingId, role, name, email, qualification, link], (err, result) => {
    if (err) return res.status(500).send(err);
    res.json({ id: result.insertId, ...req.body });
  });
});

// Update application status
app.patch('/api/applications/:id', (req, res) => {
  const { status } = req.body;
  db.query('UPDATE applications SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
    if (err) return res.status(500).send(err);
    res.json({ message: 'Status updated' });
  });
});

// Clear applications
app.delete('/api/applications', (req, res) => {
  db.query('DELETE FROM applications', (err) => {
    if (err) return res.status(500).send(err);
    res.json({ message: 'All applications cleared' });
  });
});

// Student Registration
app.post('/api/register', (req, res) => {
  console.log('--- REGISTRATION ATTEMPT ---');
  console.log('Data:', req.body);
  const { name, email, password, phone, qualification, experience, link } = req.body;
  
  if (!email || !password) {
    console.log('Missing fields');
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const sql = 'INSERT INTO users (name, email, password, phone, qualification, experience, link) VALUES (?, ?, ?, ?, ?, ?, ?)';
  db.query(sql, [name, email, password, phone, qualification, experience, link], (err, result) => {
    if (err) {
      console.error('DATABASE ERROR DURING REGISTRATION:', err);
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
      return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
    console.log('Registration successful for:', email);
    res.json({ id: result.insertId, name, email });
  });
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  console.log('Admin login attempt:', { email, password });
  db.query('SELECT * FROM admins WHERE email = ? AND password = ?', [email, password], (err, results) => {
    if (err) {
      console.error('Admin login DB error:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    if (results.length === 0) {
      console.log('Admin login failed: No match found');
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    console.log('Admin login successful');
    res.json({ message: 'Login successful', admin: results[0] });
  });
});

// Student Login
app.post('/api/login', (req, res) => {
  console.log('--- LOGIN ATTEMPT ---');
  console.log('Email:', req.body.email);
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, results) => {
    if (err) return res.status(500).send(err);
    if (results.length === 0) return res.status(401).send('Invalid credentials');
    res.json(results[0]);
  });
});

// Get all users (Admin only)
app.get('/api/users', (req, res) => {
  db.query('SELECT id, name, email, phone, qualification, experience, link, created_at FROM users ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// --- COMPANY ROUTES ---

app.post('/api/company/register', (req, res) => {
  const { name, email, password } = req.body;
  const sql = 'INSERT INTO companies (name, email, password, status) VALUES (?, ?, ?, ?)';
  db.query(sql, [name, email, password, 'pending'], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Company registered successfully. Waiting for admin approval.', id: result.insertId });
  });
});

app.post('/api/company/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM companies WHERE email = ? AND password = ?', [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    
    const company = results[0];
    if (company.status !== 'approved') {
      return res.status(403).json({ error: 'Your account is pending admin approval.' });
    }
    res.json({ message: 'Login successful', company });
  });
});

app.post('/api/company/submit-job', (req, res) => {
  const { company_id, company_name, type, title, location, salary, req: requirement } = req.body;
  const sql = 'INSERT INTO job_submissions (company_id, company_name, type, title, location, salary, req, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(sql, [company_id, company_name, type, title, location, salary, requirement, 'pending'], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Job submitted for admin review.', id: result.insertId });
  });
});

// --- ADMIN MANAGEMENT ROUTES ---

app.get('/api/admin/company-requests', (req, res) => {
  db.query('SELECT * FROM companies WHERE status = "pending" ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

app.put('/api/admin/approve-company/:id', (req, res) => {
  const { status } = req.body; // approved or rejected
  db.query('UPDATE companies SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
    if (err) return res.status(500).send(err);
    res.json({ message: `Company ${status}` });
  });
});

app.get('/api/admin/job-submissions', (req, res) => {
  db.query('SELECT * FROM job_submissions WHERE status = "pending" ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

app.post('/api/admin/post-job/:id', (req, res) => {
  db.query('SELECT * FROM job_submissions WHERE id = ?', [req.params.id], (err, results) => {
    if (err || results.length === 0) return res.status(500).send('Submission not found');
    const sub = results[0];
    
    const sql = 'INSERT INTO openings (type, title, company, location, salary, req) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [sub.type, sub.title, sub.company_name, sub.location, sub.salary, sub.req], (err) => {
      if (err) return res.status(500).send(err);
      
      db.query('UPDATE job_submissions SET status = "posted" WHERE id = ?', [req.params.id], (err) => {
        res.json({ message: 'Job posted to portal successfully!' });
      });
    });
  });
});

// --- SITE CONTENT ROUTES ---

app.get('/api/site-content', (req, res) => {
  db.query('SELECT * FROM site_content', (err, results) => {
    if (err) return res.status(500).send(err);
    const content = {};
    results.forEach(row => { content[row.content_key] = row.content_value; });
    res.json(content);
  });
});

app.post('/api/site-content', (req, res) => {
  const updates = req.body; // { key1: val1, key2: val2 }
  const promises = Object.entries(updates).map(([key, val]) => {
    return new Promise((resolve, reject) => {
      db.query('INSERT INTO site_content (content_key, content_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE content_value = ?', [key, val, val], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  Promise.all(promises)
    .then(() => res.json({ message: 'Content updated successfully' }))
    .catch(err => res.status(500).send(err));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
