const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config()
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
const app = express()
const port = process.env.PORT || 5000;
const uri=process.env.MONGODB_URI;

app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
  res.send('Hello Backend server!')
})
//studybookdb2
//e6hObnP3IonZn7vs
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
const JWKS = createRemoteJWKSet(
  new URL("http://localhost:3000/api/auth/jwks")
)
const verifyToken = async(req,res, next)=>{
    const authHeader = req?.headers.authorization;
    //console.log(authHeader)
    if(!authHeader){
      return res.status(401).json({message: "Unauthorized"})
    }
    const token = authHeader.split(" ")[1];
    //console.log(token)
    if(!token){
        return res.status(401).json({message: "Unauthorized"})
    }
    //console.log(authHeader)
    try {
       const {payload} = await jwtVerify(token, JWKS)
       req.user = payload;
       //console.log(payload)
      next()
    } catch (error) {
      return res.status(403).json({message: "Forbidden"});
      
    }
   
};
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("studybookdb2")
    const roomCollection = db.collection('rooms')
    const bookingCollection = db.collection('bookings')

    // Room API
    app.get('/room', async (req,res)=>{
      const result = await roomCollection.find().toArray();
      res.json(result)
    })
    // middleware
     app.post('/room',verifyToken, async(req,res)=>{
      //const roomData = req.body;
      console.log(req.user)
      const roomData = {
        ...req.body,
        ownerId : req.user.id,
        bookingCount:0,
        createdAt : new Date()
      }
      //console.log(roomData)
      const result = await roomCollection.insertOne(roomData);
      res.json(result)
  })
    app.get('/room/:id', verifyToken,async(req,res)=>{
    const {id} = req.params ;
    const result = await roomCollection.findOne({
      _id : new ObjectId(id)
    })
    res.json(result)

   })
  
  app.patch('/room/:id',verifyToken, async(req,res)=>{
    const {id} = req.params;
    const updateData = req.body;
    const room = await roomCollection.findOne({
      _id : new ObjectId(id)
    })
    if(!room){
      return res.status(404).json({message: "Room not found"})
    }
    if(room.ownerId !== req.user.id){
    return res.status(404).json({mesage:"You are not authorized to update this room"})
  }
    delete updateData.ownerId;

    const result = await roomCollection.updateOne({
      _id : new ObjectId(id)
    },{$set:updateData})
    res.json(result)

   })

   app.delete('/room/:id', verifyToken, async(req,res)=>{
    const {id} = req.params;
      const room = await roomCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!room) {
    return res.status(404).json({
      message: "Room not found",
    });
  }
  if(room.ownerId !== req.user.id){
    return res.status(404).json({mesage:"You are not authorized to delete this room"})
  }
    const result = await roomCollection.deleteOne({
      _id: new ObjectId(id)
    })
    res.json(result)
   })
    app.get('/featured', async(req,res)=>{
        const result =await roomCollection.find().sort({ceatedAt: -1}).limit(8).toArray();
        res.send(result)
    })
  
    app.get('/booking/:userId', async(req,res)=>{
      const {userId} =req.params;
      const result = await bookingCollection.find({userId:userId}).toArray();
      res.json(result)
    })

    app.post('/booking',verifyToken, async(req,res)=>{
      const bookingData = req.body;
      const result = await bookingCollection.insertOne(bookingData);
     const updateCount= await roomCollection.updateOne({
     
	      _id: new ObjectId (bookingData.roomId),
        },
        {$inc :{bookingCount : 1,},}
        ) ;
       console.log("updatecount", updateCount)
      res.json(result)
    })

  
    
   

   app.delete('/booking/:bookingId',verifyToken, async(req,res)=>{
    const {bookingId} = req.params;
    const result = await bookingCollection.deleteOne({
      _id: new ObjectId(bookingId)
    })
    res.json(result)

   })

   app.get('/my-bookings',verifyToken, async (req,res)=>{
    console.log( req.user);
    const result = await bookingCollection.find({
      userId : req.user.id
    }).toArray();
    res.json(result)
   })

   app.get('/my-listings',verifyToken, async (req,res)=>{
    console.log( req.user);
    const result = await roomCollection.find({
      ownerId : req.user.id
    }).toArray();
    res.json(result)
   })

   app.patch('/booking/:bookingId/cancel',verifyToken, async(req,res)=>{
    const {bookingId} = req.params;
    const result = await bookingCollection.updateOne({
      _id: new ObjectId(bookingId)
      
    },
    {$set:{status : "cancelled"}})
    res.json(result)

   })
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})