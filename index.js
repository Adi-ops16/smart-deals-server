const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken')
const cors = require('cors');
const app = express();
const admin = require("firebase-admin");
const port = process.env.PORT || 3000;



const serviceAccount = require("./adminSDK.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// middleware
app.use(cors())
app.use(express.json())

const verifyFirebaseToken = async (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" })
    }
    const token = (req.headers.authorization).split(' ')[1]
    if (!token) {
        return res.status(401).send({ message: "Unauthorized access" })
    }
    try {
        const userInfo = await admin.auth().verifyIdToken(token)
        req.token_email = userInfo.email
        next()
    } catch (error) {
        console.log(error);
        return res.status(401).send({ message: "Unauthorized access" })
    }
}

const verifyJWTToken = (req, res, next) => {
    const authorization = req.headers.authorization
    if (!authorization) {
        return res.status(401).send({ message: "unauthorized access" })
    }
    const token = authorization.split(' ')[1]
    if (!token) {
        return res.status(401).send({ message: "unauthorized access" })
    }
    jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error) {
            return res.status(401).send({ message: "unauthorized access" })
        }
        req.token_email = decoded.email
    })
    next()
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@personal-hero.gxzvpbe.mongodb.net/?appName=Personal-Hero`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect()
        const db = client.db('smart_deals_db')
        const productsCollection = db.collection('products')
        const bidsCollection = db.collection('bids')
        const usersCollection = db.collection('users')


        // USERS APIs
        app.post('/users', async (req, res) => {
            const newUser = req.body;

            const email = req.body.email
            const query = { email: email }
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) { return }
            const result = await usersCollection.insertOne(newUser)
            res.send(result)
        })

        // PRODUCTS APIs
        app.get('/products', async (req, res) => {
            const cursor = productsCollection.find().sort({ price_min: -1 })
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get('/latest-products', async (req, res) => {
            const cursor = productsCollection.find().sort({ created_at: -1 }).limit(6)
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: id }
            const result = await productsCollection.findOne(query)
            console.log(result);
            res.send(result)
        })


        app.post('/products', verifyFirebaseToken, async (req, res) => {
            const newProduct = req.body;
            const result = await productsCollection.insertOne(newProduct)
            res.send(result)
        })

        app.patch('/products/:id', async (req, res) => {
            const id = req.params.id
            const updatedProduct = req.body;
            const query = {
                _id: new ObjectId(id)
            }
            const update = {
                $set: {
                    name: updatedProduct.name,
                    price: updatedProduct.price
                }
            }
            const result = await productsCollection.updateOne(query, update)
            res.send(result)
        })

        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id
            const query = {
                _id: new ObjectId(id)
            }
            const result = await productsCollection.deleteOne(query)
            res.send(result)
        })

        // jwt related apis
        app.post('/getToken', (req, res) => {
            const loggedUser = req.body
            const token = jwt.sign(loggedUser, process.env.JWT_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        app.get('/bids', verifyFirebaseToken, async (req, res) => {
            const email = req.query.email;
            const query = {}
            if (email) {
                query.buyer_email = email
            }
            // verifying user
            if (email !== req.token_email) {
                return res.status(403).send({ message: "forbidden access" })
            }
            const cursor = bidsCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        // bids related apis with firebase access token
        // app.get('/bids', verifyFirebaseToken, async (req, res) => {
        //     console.log(req);
        //     const email = req.query.email
        //     const query = {}
        //     if (email) {
        //         if (email !== req.token_email) {
        //             return res.status(403).send({ message: "Forbidden access" })
        //         }
        //         query.buyer_email = email
        //     }
        //     const cursor = bidsCollection.find(query)
        //     const result = await cursor.toArray()
        //     res.send(result)
        // })

        app.get('/products/bids/:productId', verifyFirebaseToken, async (req, res) => {
            const productId = req.params.productId
            const query = { product: productId }
            const cursor = bidsCollection.find(query).sort({ bid_price: -1 })
            const result = await cursor.toArray()
            res.send(result)
        })

        app.post('/bids', async (req, res) => {
            const newBid = req.body;
            const result = await bidsCollection.insertOne(newBid)
            res.send(result)
        })

        app.delete('/bids/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bidsCollection.deleteOne(query)
            res.send(result)
        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {

    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('smart deals server is running ')
})


app.listen(port, () => {
    console.log(`smart deals server is running on port: ${port}`);
})
