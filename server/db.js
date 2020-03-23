const MongoClient = require("mongodb").MongoClient;
const uri =
  "mongodb+srv://myself:<password>@cluster0-xlyk2.mongodb.net/test?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true });
const connect = () => {
  console.log("CONNECTING!");
  return client.connect(err => {
    const collection = client.db("test").collection("devices");
    console.log({ collection, client });
    // perform actions on the collection object
    // client.close();
    return client;
  });
};

export default connect;
