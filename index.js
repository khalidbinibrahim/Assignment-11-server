const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://khalid-bin-ibrahim-11.firebaseapp.com',
        'https://khalid-bin-ibrahim-11.web.app'
    ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hguto33.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Connect to MongoDB
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Middleware to verify token
const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.user = decoded;
        next();
    });
};

async function run() {
    try {
        await client.connect();

        const db = client.db('volunteerDB');
        const volunteerNeedsCollection = db.collection('volunteerNeeds');
        const volunteerRequestsCollection = db.collection('volunteerRequests');
        const usersCollection = db.collection('users');

        // ==========---- AUTH RELATED API ----==========
        app.post('/jwt', async (req, res) => {
            try {
                const { email } = req.body;
                const user = await usersCollection.findOne({ email });

                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }

                const token = jwt.sign({ email: user.email, userId: user._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '4hr' });
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: false
                });
                res.status(200).json({ message: 'User authenticated', token });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // ==========---- USER ----==========
        app.get('/api/user_data', verifyToken, async (req, res) => {
            try {
                const { email } = req.user;
                const user = await usersCollection.findOne({ email }, { projection: { password: 0 } });

                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }

                res.status(200).json({ user });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // ==========---- GET ----==========
        // API endpoint to fetch volunteer needs sorted by upcoming deadlines
        app.get('/api/add_volunteer_post', async (req, res) => {
            try {
                const volunteerNeeds = await volunteerNeedsCollection.find().sort({ deadline: 1 }).limit(6).toArray();
                res.json(volunteerNeeds);
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // GET volunteers of the currently authenticated user
        app.get("/api/user_volunteer_post/:id", verifyToken, async (req, res) => {
            try {
                const userId = req.params.id;
                if (req.user.userId !== userId) {
                    return res.status(403).json({ error: 'Forbidden' });
                }

                const cursor = volunteerNeedsCollection.find({ user_id: userId });
                const result = await cursor.toArray();
                res.json(result);
            } catch (error) {
                console.error('Error fetching user volunteer:', error);
                res.status(500).json({ error: 'Failed to fetch user volunteer' });
            }
        });

        // GET all request for volunteers of the currently authenticated user
        app.get('/api/user_request_volunteer/:id', verifyToken, async (req, res) => {
            try {
                const userId = req.params.id;
                if (req.user.userId !== userId) {
                    return res.status(403).json({ error: 'Forbidden' });
                }

                const result = await volunteerRequestsCollection.find({ user_id: userId }).toArray();
                res.json(result);
            } catch (error) {
                console.error('Error fetching volunteer requests:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // ==========---- POST ----==========
        // Post request for be a volunteer
        app.post('/api/request_volunteer', verifyToken, async (req, res) => {
            try {
                const { postId, volunteerName, volunteerEmail, suggestion } = req.body;
                const userId = req.user.userId;

                await volunteerRequestsCollection.insertOne({
                    postId,
                    volunteerName,
                    volunteerEmail,
                    user_id: userId,
                    suggestion,
                    status: 'requested'
                });

                await volunteerNeedsCollection.updateOne(
                    { _id: new ObjectId(postId) },
                    { $inc: { volunteersNeeded: -1 } }
                );

                res.status(201).json({ message: 'Volunteer request submitted successfully' });
            } catch (error) {
                console.error('Error submitting volunteer request:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // Post request for add a volunteer
        app.post('/api/add_volunteer_post', verifyToken, async (req, res) => {
            try {
                const { category, description, location, thumbnail, postTitle, volunteersNeeded, deadline, organizerName, organizerEmail } = req.body;
                const userId = req.user.userId;

                const updatedVolunteersNeeded = parseInt(volunteersNeeded);

                // Store data in MongoDB or your preferred database
                await volunteerNeedsCollection.insertOne({
                    thumbnail,
                    postTitle,
                    description,
                    category,
                    location,
                    volunteersNeeded: updatedVolunteersNeeded,
                    deadline,
                    organizerName,
                    organizerEmail,
                    user_id: userId
                });

                res.status(201).json({ message: 'Volunteer post added successfully' });
            } catch (error) {
                console.error('Error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // ==========---- DELETE ----==========
        // DELETE a volunteer by ID
        app.delete('/api/add_volunteer_post/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id), user_id: req.user.userId };
            const result = await volunteerNeedsCollection.deleteOne(query);
            res.send(result);
        });

        // DELETE a request for volunteer
        app.delete('/api/request_volunteer/:id', verifyToken, async (req, res) => {
            const requestId = req.params.id;
            const query = { _id: new ObjectId(requestId), user_id: req.user.userId };
            try {
                const result = await volunteerRequestsCollection.deleteOne(query);
                res.json({ message: 'Volunteer request deleted successfully' });
                res.send(result);
            } catch (error) {
                console.error('Error deleting volunteer request:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // ==========---- PUT ----==========
        // PUT to update a volunteer post by ID
        app.put('/api/add_volunteer_post/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;
            const query = { _id: new ObjectId(id), user_id: req.user.userId };
            const result = await volunteerNeedsCollection.updateOne(query, { $set: updatedData });
            res.send(result);
        });

        app.get('/', (req, res) => {
            res.send('Server is running');
        });

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);