// 从etcd上面获取某个路径下面的商务推广配置

var debugloger = require("./debug_log").debugloger
var poolModule = require("generic-pool");
var path = require("path");
var Config = require("../conf/config_dev.js");
Etcd = require('node-etcd');
etcd = new Etcd(Config.etcd_host);

var configKeyPrefix = "/project/nameservice/module/conn";
var InterFaceCache = {};
var server_list = {}

var black_server_key = "/project/backend_config/js_proxy_forward/black_server";
var black_server_map = {}
var error_interface_map = {}
var access_stat = {}
var black_server_mdfIdx = -1

modifiedIndex = null

// start
EtcdGetKey();
InitBlackServer();


//////////////////////////////////////////////////////function/////////////////////////////////////////////
function EtcdGetKey() {
  etcd.get(configKeyPrefix, { recursive: true }, function(err, data) {
    if (err) {
      debugloger.error("etcd get :", configKeyPrefix, "faild");
      return;
    }
    debugloger.info("data:", data);
    if (data['node'] && data['node']['modifiedIndex']) {
      modifiedIndex = data['node']['modifiedIndex'];
      debugloger.log("modifiedIndex:", modifiedIndex);
    }
    parseConfig(data);
    configWatcher = etcd.watcher(configKeyPrefix, modifiedIndex, {recursive: true});
    EtcdOnEvent(configWatcher)
    blackServerWatcher = etcd.watcher(black_server_key, modifiedIndex, {recursive: true});
    BlackServerOnEvent(blackServerWatcher)
  })
}

function EtcdSetkey(key, value) {
  etcd.set(key, value, function(err, data){
    if (err) {
      console.log("set key:", key, "data:", value, "err:", err);
      return;
    }
    console.log("set key:", key, "data:", value, "sucess", "resp data:", data);
    if (data['node'] && data['node']['modifiedIndex']) {
      black_server_mdfIdx = data['node']['modifiedIndex'];
    }
    });
}

function InitBlackServer() {
  etcd.get(black_server_key, function(err, data){
    if (err) {
      console.log("set key:", key, "data:", value, "err:", err);
      return;
    }
    console.log("data:", data);
    if (!data['node'] || !data['node']['key']) return;
    value = data['node']['value'];
    console.log("key:", data['node']['key'], "value:", value);
    var blackServerobj = JSON.parse(value);
    if (blackServerobj) {
      black_server_map = blackServerobj;
    } else {
      console.log("err data...");
    }
    });
}

function EtcdOnEvent(configWatcher) {
  configWatcher.on("change", function(change) {
    if (!change['action']) {
      debugloger.error("not find action for change");
      return;
    }
    if (change['node'] && change['node']['key'] && change['node']['modifiedIndex']) {
     debugloger.info("---recv change: action", change['action'], "key:", change['node']['key'], "modifiedIndex:", change['node']['modifiedIndex']);
    }
    if (change['action'] == 'set') {
      try {
        key = change['node']['key'];
        values = change['node']['value'];
        values = JSON.parse(values)
        server_addr = path.basename(key);
        if (!checkaddr(server_addr)) {
          debugloger.log("err server addr:", server_addr);
          return;
        }

        values = values['interfaces'];
        if (!values) return;

        RemoveServer(server_addr);
        InterFaceCache[server_addr] = values;

        var num = InterFaceCache[server_addr].length;
        for (i = 0; i < num; i++) {
          var result = new Array();
          var interface_list = server_list[InterFaceCache[server_addr][i]];
          if (interface_list) {
            for (size = 0; size < interface_list.length; size++) {
              result.push(interface_list[size]);
            }
          }
          if (result.indexOf(server_addr) == -1) {
            result.push(server_addr);
          }
          server_list[InterFaceCache[server_addr][i]] = result;
        }
      } catch (e) {
        debugloger.error("catch abnormal:", e);
      }
    } else {
      debugloger.log(" find expire action:", change['action']);
      try {
        key = change['node']['key'];
        server_addr = path.basename(key);
        RemoveServer(server_addr);
      } catch (e) {
        debugloger.error("catch abnormal:", e);
      }
    }
  });
  configWatcher.on("stop", function(change) {
    debugloger.error("---recv stop init etcd ");
    EtcdGetKey()
  })
}

function BlackServerOnEvent(blackServerWatcher) {
  blackServerWatcher.on("change", function(change) {
    if (!change['action']) {
      debugloger.error("not find action for change");
      return;
    }
    if (!change['node'] || !change['node']['key']) return;
    if (-1 != black_server_mdfIdx &&
      change['node']['modifiedIndex'] &&
      change['node']['modifiedIndex'] == black_server_mdfIdx) {
      console.log("modifiedIndex is :", black_server_mdfIdx, "not update");
      return;
    }

    value = change['node']['value'];
    console.log("BlackServerOnEvent key:", change['node']['key'], "value:", value);
    var blackServerobj = JSON.parse(value);
    if (blackServerobj) {
      black_server_map = blackServerobj;
    }
  });
}


function isIP(strIP) {
  var re=/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/g; //匹配IP地址的正则表达式
  if(re.test(strIP))  {
    if( RegExp.$1 <256 && RegExp.$2<256 && RegExp.$3<256 && RegExp.$4<256) return true;
  }
  debugloger.log("err ip:", strIP)
  return false;
}

function validateNum(input, min, max) {
      var num = +input;
      return num >= min && num <= max && input === num.toString();
}

function checkaddr(input) {
  var parts = input.split(":");
  if (!parts) return false;
  var ip = parts[0];
  var port = parts[1];
  return (validateNum(port, 1, 65535) && isIP(ip))
}

function parseConfig(etcd_data) {
  var configData = {};
  var pathData = etcd_data.node;
  var valuse_key_path = pathData.key;
  var allPtData = pathData.nodes;
  if (!(allPtData instanceof Array)) {
    return null;
  }
  configData = allPtData;
  for (k = 0; k < configData.length; k++) {
    node_size = configData[k].length;
    node_data = configData[k];
    key = node_data['key'];
    obj = node_data['value'];
    if (!key || !obj) continue;
    value = JSON.parse(obj)
    value = value['interfaces'];
    if (!value) {
      debugloger.error("key:", key, "data:", value, "expire");
      continue;
    }
    server_addr = path.basename(key);
    if (!checkaddr(server_addr)) {
      debugloger.error("err server addr:", server_addr);
      continue;
    }
    InterFaceCache[server_addr] = value;
    var num = InterFaceCache[server_addr].length;
    for (i = 0; i < num; i++) {
      var result = new Array();;
      var interface_list = server_list[InterFaceCache[server_addr][i]];
      if (interface_list) {
        for (size = 0; size < interface_list.length; size++) {
          result.push(interface_list[size]);
        }
      }
      if (result.indexOf(server_addr) == -1) {
        result.push(server_addr);
      }
      server_list[InterFaceCache[server_addr][i]] = result;
    }
  }
}




var etcd_pool = poolModule.Pool({
  name     : 'etcd_pool',
  // 将建 一个 连接的 handler
  create   : function(callback) {
    var c = new Etcd(Config.etcd_host);
    callback(null, c);
  },
  // 释放一个连接的 handler
  destroy  : function(client) {},
  // 连接池中最大连接数量
  max      : 10,
  // 连接池中最少连接数量
  min      : 2,
  // 如果一个线程3秒钟内没有被使用过的话。那么就释放
  idleTimeoutMillis : 3000,
  // 如果 设置为 true 的话，就是使用 console.log 打印入职，当然你可以传递一个 function 最为作为日志记录handler
  log : false
});

// app 配置先全部缓存内存  监控app配置变化
var appConfigData = {};

function GetRandomNum(Min,Max) {
  var Range = Max - Min;
  var Rand = Math.random();
  return(Min + Math.round(Rand * Range));
}

function AddErrInterface(func) {
  var cnt = error_interface_map[func];
  if (!cnt) {
    cnt = 1
  } else {
    cnt++;
  }
  error_interface_map[func] = cnt;
}

function GetFuncServer(path) {
  debugloger.info("GetFuncServer key:", path);
  try {
    var addr_list = server_list[path];
    if (!addr_list) {
      debugloger.info("not find:", path);
      AddErrInterface(path);
      return "";
    }
    var select_server_list = new Array();
    for (var cnt = 0; cnt < addr_list.length; cnt++) {
      var filter_key = path + "_" + addr_list[cnt];
      if (black_server_map[filter_key]) {
        console.log("find a filter key :", filter_key);
        continue;
      }
      select_server_list.push(addr_list[cnt]);
    }
    var num = select_server_list.length;
    if (num == 0) {
      console.log("not find server fot interface:", path);
      debugloger.info("not find server fot interface:", path);
      AddErrInterface(path);
      return "";
    }
    var select_addr = select_server_list[GetRandomNum(0, num-1)];
    var accecc_cnt = access_stat[path + "_" + select_addr];
    if (accecc_cnt) {
      accecc_cnt++;
      access_stat[path + "_" + select_addr] = accecc_cnt;
    }  else {
      access_stat[path + "_" + select_addr] = 1;
    }
    return select_addr;
  } catch (e) {
    debugloger.info("GetFuncServer catch abnormal path:", path, "abnormal:", e);
  }
}

function RemoveServer(server_addr) {
  debugloger.log("RemoveServer :", server_addr);
  delete InterFaceCache[server_addr];
  for (key in server_list) {
    addr_list = server_list[key];
    for (index = 0; index < addr_list.length; index++) {
      if (addr_list[index] == server_addr) {
        addr_list.splice(index, 1);
      }
    }
    if (addr_list.length == 0) {
      debugloger.info("no addr for key:", key, "del it");
      delete server_list[key];
    }
  }
  debugloger.info("after RemoveServer:", server_addr, "server_list:", server_list);
}

function GetServerStat() {
  console.log("GetServerStat start");
  var stat_server_arry = new Array();
  for (var obj in server_list) {
    var stat_server_obj = new Object();
    var ret_server_list = new Array();
    for (var cnt = 0; cnt < server_list[obj].length; cnt++) {
      var check_key = obj + "_" + server_list[obj][cnt];
      var ret_data = new Object();
      if (black_server_map[check_key]) {
        // console.log("find check_key:", check_key, "data:", black_server_map[check_key])
        ret_data["key"] = server_list[obj][cnt];
        ret_data["value"] = 0;
      } else {
        ret_data["key"] = server_list[obj][cnt];
        ret_data["value"] = 1;
      }
      if (access_stat[check_key]) {
        ret_data["accecc_num"] = access_stat[check_key];
      } else {
        ret_data["accecc_num"] = 0;
      }
      ret_server_list.push(ret_data);
    }
    stat_server_obj[obj] = ret_server_list;
    stat_server_arry.push(stat_server_obj);
  }
  stat_server_arry = stat_server_arry.sort(function(a,b){
    var acc_a = 0;
    var acc_b = 0;
    var func;
    for (var i in a) {
      for (var size = 0; size < a[i].length; size++) {
        acc_a += a[i][size].accecc_num;
      }
      func = i
    }
    for (var i in b) {
      for (var size = 0; size < b[i].length; size++) {
        acc_b += b[i][size].accecc_num;
      }
    }
    return acc_b - acc_a
    });
  return stat_server_arry;
}

function GetErrorServerStat() {
  console.log("GetErrorServerStat start");
  var stat_server_arry = new Array();
  for (var obj in error_interface_map) {
    var ret_data = new Object();
    ret_data["func"] = obj;
    ret_data["cnt"] = error_interface_map[obj];
    stat_server_arry.push(ret_data);
  }

  stat_server_arry = stat_server_arry.sort(function(a,b){
    return a["cnt"] - b["cnt"];
    });
  console.log("error_interface:", stat_server_arry);
  return stat_server_arry;
}

function SetblackInterface(set_key, flag) {
  if ("0" == flag) {
    // del config
    if (black_server_map[set_key] && '0' != black_server_map[set_key]) {
      console.log("this maby a error key :", key , "data:", black_server_map[set_key]);
    }
    black_server_map[set_key] = '0';
    console.log("add black_server_map:", black_server_map);

  } else if ("1" == flag) {
    // set config
    if (black_server_map[set_key]) {
      delete black_server_map[set_key];
    }
    console.log("del black_server_map:", black_server_map);
  }
  var arry_values = set_key.split('_');
  if (arry_values.length != 2) return "";

  var ret_data = new Object();
  ret_data["func"] = arry_values[0];
  ret_data["addr"] = arry_values[1];
  ret_data["value"] = flag;
  values = JSON.stringify(ret_data);
  console.log("SetblackInterface ret:", values);
  EtcdSetkey(black_server_key, JSON.stringify(black_server_map));
  return values;
}

function GetServerInfo(key) {
  var stat_server_arry = new Array();
  for (var obj in server_list) {
    var obj_data = new Object();
    var check_key = obj + "_" + key;
    for (var cnt = 0; cnt < server_list[obj].length; cnt++) {
      if (server_list[obj][cnt] != key) continue;
      obj_data["func"] = obj;
      if (access_stat[check_key]) {
        obj_data["accecc_num"] = access_stat[check_key];
      } else {
        obj_data["accecc_num"] = 0;
      }
      if (black_server_map[check_key]) {
        obj_data["value"] = 0;
      } else {
        obj_data["value"] = 1;
      }
      stat_server_arry.push(obj_data);
    }
  }
  stat_server_arry = stat_server_arry.sort(function(a,b){
    var acc_a = a['accecc_num'];
    var acc_b = b['accecc_num'];
    return acc_b - acc_a
    });
  return stat_server_arry;
}

function GetServerList() {
  var stat_server_arry = new Array();
  for (var obj in InterFaceCache) {
    stat_server_arry.push(obj);
  }
  console.log("GetServerList stat_server_arry:", stat_server_arry);
  return stat_server_arry;
}



exports.GetServerStat = GetServerStat;
exports.GetErrorServerStat = GetErrorServerStat;
exports.RemoveServer = RemoveServer;
exports.GetFuncServer = GetFuncServer;
exports.SetblackInterface = SetblackInterface;
exports.GetServerInfo = GetServerInfo;
exports.GetServerList = GetServerList;
