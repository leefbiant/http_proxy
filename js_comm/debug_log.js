var fs = require('fs');
var path = require('path');

Date.prototype.Format = function (fmt) { 
  var o = {
    "M+": this.getMonth() + 1, //月份 
    "d+": this.getDate(), //日 
    "h+": this.getHours(), //小时 
    "m+": this.getMinutes(), //分 
    "s+": this.getSeconds(), //秒 
    "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
    "S": this.getMilliseconds() //毫秒 
  };
  if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
  for (var k in o)
    if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
  return fmt;
}




var base_dir = path.dirname(__dirname);
var debugloger = require('tracer').console({
  dateformat : "[yyyy-mm-dd HH:MM:ss.l]",
  transport : function(data) {
    // console.log(data.output);
    var daystr=new Date().Format("yyyyMMdd");
    var logfile = base_dir + '/logs/debug-' + daystr + ".log";
    fs.appendFile(logfile , data.output + '\n', (err) => {
      if (err) throw err;
      });
    }
});


exports.debugloger = debugloger;
