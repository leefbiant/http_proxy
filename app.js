var express = require('express');
var syspath = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var fs = require('fs')
var FileStreamRotator = require('file-stream-rotator')
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var FuncListMap = require("./js_comm/service_list")
var debugloger = require("./js_comm/debug_log").debugloger
var request = require("request");
var Config = require("./conf/config_dev.js");

var users = require('./routes/users');
var index = require('./routes/index');
var stat = require('./routes/stat');
var ejs = require('ejs');


var app = express();
var logDirectory = __dirname + '/logs'
// ensure log directory exists
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory)

// create a rotating write stream
var accessLogStream = FileStreamRotator.getStream({
  date_format: 'YYYYMMDD',
  filename: syspath.join(logDirectory, 'access-%DATE%.log'),
  frequency: 'daily',
  verbose: false
})  

// view engine setup
app.set('views', syspath.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.engine('.html', ejs.__express);
app.set('view engine', 'html');

app.use(logger('combined', {stream: accessLogStream}))
app.use(bodyParser.raw());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(syspath.join(__dirname, 'public')));

app.use('/index', index);
app.use('/users', users);
app.use('/stat', stat);
app.use(function(req, res, next) {
  var path = req.url;
  if (path && path[0] == "/") {
    path = path.substring(1);
  }
  console.log("app user main get method:", req.method, "url:", req.url);
  req.rpcName = path;
  var dataLen = req.headers['content-length'];
  if (!dataLen || dataLen <= 0) {
    res.writeHead(409);
    res.end("");
    return;
  }
  var dataBuf = new Buffer(parseInt(dataLen));
  var dataArray = [];
  var recvLen = 0;
  req.on('data', function (chunk) {
    dataArray.push(chunk);
    recvLen += chunk.length;
  });
  req.on('end', function () {
    var binData = Buffer.concat(dataArray, recvLen);
    req.protoReqOK = false;
    try {
      req.rawProtoBufData = binData;
      var server_addr = FuncListMap.GetFuncServer(path)
      if (server_addr && server_addr != "") {
           debugloger.log("forward ", path, "to server_addr:", server_addr);
           req.protoReqOK = true;
           request.post({headers:req.headers, uri:"http://"+server_addr+"/" + req.rpcName, body:req.rawProtoBufData, encoding:null}, function(error, resp, body) {
           if (error && error.code) {
             if (error.code == 'ECONNREFUSED') {
               debugloger.log("----error: Service is not available err:", error);
               FuncListMap.RemoveServer(server_addr);
             }
           }
           res.setHeader("connection", "close");
           res.send(body);
         });
        } else {
          next();
        }
    } catch (e) {
      debugloger.log("catch abnormal %s", e);
      next();
    }
  });

  res.replyProto = function(retProto) {
    try {
      res.setHeader("connection", "close");
      var buf = new Buffer(retProto.serializeBinary());
      res.send(new Buffer(retProto.serializeBinary()));
    } catch (e) {
      debugloger.log("replyProto serializeBinary error %s", e);
      res.send("", 403);
    }
  }
});

app.use(function(req, res, next) {
  if (!req.protoReqOK) {
    debugloger.warn("redirect rpc " + req.rpcName + " to server:", Config.default_conn_addr);
    request.post({uri:"http://" +Config.default_conn_addr + "/" + req.rpcName, body:req.rawProtoBufData, encoding:null}, function(error, resp, body) {
      res.setHeader("connection", "close");
      res.send(body);
    });
  } else {
    next();
  }
  // 转发到其他处理器
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
