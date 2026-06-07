const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const db = require('./db');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Undangan API',
      version: '1.0.0',
      description: 'API untuk mengelola data undangan',
    },
    servers: [
      {
        url: '/',
        description: 'Current server',
      },
    ],
  },
  apis: [path.join(process.cwd(), 'src', '*.js')], // Path to API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /api/undangan/{userid}:
 *   get:
 *     summary: Get all invitations for a user
 *     parameters:
 *       - in: path
 *         name: userid
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 */

// [GET] => /api/undangan/:userid with pagination
app.get('/api/undangan/:userid', async (req, res) => {
  try {
    const { userid } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    // Validate parameters
    if (page < 1 || limit < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters. Page and limit must be greater than 0.'
      });
    }

    // Get total count
    const [countRows] = await db.query(
      'SELECT COUNT(*) as total FROM undangans WHERE userid = ? AND deleted_at IS NULL',
      [userid]
    );
    const totalItems = countRows[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    // Get paginated data
    const [rows] = await db.query(
      'SELECT * FROM undangans WHERE userid = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT ? OFFSET ?',
      [userid, limit, offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/undangan:
 *   post:
 *     summary: Create a new invitation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - alamat
 *               - kehadiran
 *               - userid
 *             properties:
 *               name:
 *                 type: string
 *               alamat:
 *                 type: string
 *               ucapan:
 *                 type: string
 *               kehadiran:
 *                 type: string
 *                 enum: [hadir, tidak_hadir, belum_pasti]
 *               userid:
 *                 type: string
 *               ket:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */

// [POST] => /api/undangan
app.post('/api/undangan', async (req, res) => {
  try {
    const { name, alamat, ucapan, kehadiran, userid, ket } = req.body;

    // Validation
    if (!name || !alamat || !kehadiran || !userid) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, alamat, kehadiran, and userid are required.'
      });
    }

    // Validate enum values for kehadiran
    const allowedKehadiran = ['hadir', 'tidak_hadir', 'belum_pasti'];
    if (!allowedKehadiran.includes(kehadiran)) {
      return res.status(400).json({
        success: false,
        message: `Invalid kehadiran value. Allowed values are: ${allowedKehadiran.join(', ')}`
      });
    }

    // Insert record
    const [result] = await db.query(
      `INSERT INTO undangans (name, alamat, ucapan, kehadiran, userid, ket, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [name, alamat, ucapan || null, kehadiran, userid, ket || null]
    );

    // Fetch the inserted record
    const [newRow] = await db.query('SELECT * FROM undangans WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Invitation successfully created',
      data: newRow[0]
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Export handler for local testing (Express app) and Netlify serverless function
module.exports = app;
module.exports.handler = serverless(app);
