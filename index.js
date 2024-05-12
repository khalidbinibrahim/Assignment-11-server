const express = require('express');
const cors = require('cors');
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
    ]
}));
app.use(express.json());

// MongoDB connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hguto33.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Connect to MongoDB
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const db = client.db('volunteerDB');
        const volunteerNeedsCollection = db.collection('volunteerNeeds');
        const volunteerRequestsCollection = db.collection('volunteerRequests');

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
        app.get("/api/user_volunteer_post/:id", async (req, res) => {
            try {
                const userId = req.params.id;
                const cursor = volunteerNeedsCollection.find({ user_id: userId });
                const result = await cursor.toArray();
                res.json(result);
            } catch (error) {
                console.error('Error fetching user volunteer:', error);
                res.status(500).json({ error: 'Failed to fetch user volunteer' });
            }
        });

        // GET all request for volunteers of the currently authenticated user
        app.get('/api/user_request_volunteer/:id', async (req, res) => {
            try {
                const Id = req.params.id;
                const result = await volunteerRequestsCollection.find({ user_id: Id }).toArray();
                res.json(result);
            } catch (error) {
                console.error('Error fetching volunteer requests:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        app.post('/api/request_volunteer', async (req, res) => {
            try {
                const { postId, volunteerName, volunteerEmail, user_id, suggestion } = req.body;

                // Store volunteer request information in the new collection
                await volunteerRequestsCollection.insertOne({
                    postId,
                    volunteerName,
                    volunteerEmail,
                    user_id,
                    suggestion,
                    status: 'requested'
                });

                await volunteerNeedsCollection.updateOne(
                    { _id: postId },
                    { $inc: { volunteersNeeded: -1 } }
                );

                res.status(201).json({ message: 'Volunteer request submitted successfully' });
            } catch (error) {
                console.error('Error submitting volunteer request:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        app.post('/api/add_volunteer_post', async (req, res) => {
            try {
                const { category, description, location, thumbnail, postTitle, volunteersNeeded, deadline, organizerName, organizerEmail, user_id } = req.body;

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
                    user_id
                });

                res.status(201).json({ message: 'Volunteer post added successfully' });
            } catch (error) {
                console.error('Error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // DELETE a volunteer by ID
        app.delete('/api/add_volunteer_post/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await volunteerNeedsCollection.deleteOne(query);
            res.send(result);
        });

        app.delete('/api/request_volunteer/:id', async (req, res) => {
            const requestId = req.params.id;
            try {
                const query = { _id: new ObjectId(id) };
                const result = await volunteerRequestsCollection.deleteOne(query);
                res.json({ message: 'Volunteer request deleted successfully' });
                res.send(result);
            } catch (error) {
                console.error('Error deleting volunteer request:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // PUT to update a tourist spot by ID
        app.put('/api/add_volunteer_post/:id', async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;
            const query = { _id: new ObjectId(id) };
            const result = await volunteerNeedsCollection.updateOne(query, { $set: updatedData });
            res.send(result);
        });

        app.get('/', (req, res) => {
            res.send('Server is running');
        })

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

