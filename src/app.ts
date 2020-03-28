import express from "express"

let app = express();

app.use('/static', express.static("assets"))
app.use('/static/js', express.static("dist/ui"))

app.get('/', (req,res) => {
    res.send("hello, world");
});

app.listen(8080, () => {
    console.log("listening on port 8080");
})
