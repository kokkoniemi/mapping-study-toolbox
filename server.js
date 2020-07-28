const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = 3000;

app.use(bodyParser.json());

const corsConfig = function (req, res, next) {
    const allowedOrigins = ['http://localhost:8080', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (allowedOrigins.indexOf(origin) > -1) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
}

app.use(corsConfig);

app.use(express.static('public'));

const routes = require("./routes/api");
app.use("/api", routes);

app.listen(port, () => console.log(`Api listening on port ${port}`));