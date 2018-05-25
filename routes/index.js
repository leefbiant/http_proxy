var express = require('express');
var router = express.Router();
var FuncListMap = require("../js_comm/service_list")

router.get('/', function(req, res, next) {
    var server_list = FuncListMap.GetServerList();
    var server_obj = ""
    for (var cnt = 0; cnt < server_list.length; ++cnt) {
      var content = '<li><a href="/stat/GetServerInfo?key=' + server_list[cnt] + '">' + server_list[cnt] + '</a></li>'
      server_obj += content;
    }
    res.render('index', {title:'etcd stat', server_list:server_obj});
    return;
});

module.exports = router;

