var express = require('express');
// var document = require('document');
var router = express.Router();

var syspath = require('path');
var sysurl = require('url');
var querystring  = require("querystring");
var FuncListMap = require("../js_comm/service_list")

/* GET stats listing. */
router.get('/', function(req, res, next) {
    var ret_obj = FuncListMap.GetServerStat();
    var ret_value = JSON.stringify(ret_obj);
    res.render('server_stat', {title:'etcd stat', ret_data:ret_value});
    return;
});

router.get('/ErrInterface', function(req, res, next) {
  var ret_err_arry = FuncListMap.GetErrorServerStat();
  var ret_obj = {};
  ret_obj['ret_code'] = 0;
  ret_obj['size'] = ret_err_arry.length;
  ret_obj['data'] = ret_err_arry;
  var ret_err_value = JSON.stringify(ret_obj);
  res.render('server_err_stat', {title:'etcd stat', err_func_info:ret_err_value});
  return;

});

router.get('/GetServerInfo', function(req, res, next) {
  var arg = sysurl.parse(req.url).query;
  if (!arg) {
    console.log("not find arg form url:", req.url);
    return;
  }
  var data = querystring.parse(arg);
  if (!data) {
    console.log("parse failed arg:", arg);
    return;
  }
  var value = FuncListMap.GetServerInfo(data.key);
  var server_addr = {};
  server_addr["addr"] = data.key;
  var ret_value = JSON.stringify(value);
  var ret_server_addr = JSON.stringify(server_addr);
  res.render('server_info', {title:'server stat', server:ret_server_addr, body:ret_value});
  return;
});

router.get('/ServerList', function(req, res, next) {
  var arg = sysurl.parse(req.url).query;
  if (!arg) {
    console.log("not find arg form url:", req.url);
    return;
  }
  var data = querystring.parse(arg);
  if (!data) {
    console.log("parse failed arg:", arg);
    return;
  }
  var value = FuncListMap.GetServerInfo(data.key);
  var server_addr = {};
  server_addr["addr"] = data.key;
  var ret_value = JSON.stringify(value);
  var ret_server_addr = JSON.stringify(server_addr);
  res.render('server_info', {title:'server stat', server:ret_server_addr, body:ret_value});
  return;
});


router.post('/SetFuncServerStat', function(req, res, next) {
   console.log("uri:", req.url, "data:", req.body.data);
   var req_data = JSON.parse(req.body.data);

   if (!req_data || !req_data.key) {
     console.log("err post data:", req_data);
     return;
   }
   var ret = FuncListMap.SetblackInterface(req_data.key, req_data.value);
   res.send(ret);
   return;
});


module.exports = router;
