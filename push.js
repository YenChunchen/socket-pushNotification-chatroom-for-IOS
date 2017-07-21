var apns = require('apn');
var fs=require('fs');
var connectdb=require('./model/connectdb.js');

async function sendPushNotification(newMessageResult,roomID){
  // console.log('newMessageResult',newMessageResult);
  var allMemberArr=await getAllPushMember(roomID,newMessageResult.id);//取得發送者以外成員Id
  // console.log(allMemberArr);
  var allPushDeviceToken=[];
  for(var i in allMemberArr){ //依序取得其餘成員deviceToken
    var temp=await getMemberDeviceToken(allMemberArr[i]);
    // console.log(typeof temp);
    if(typeof temp==='string'){
      allPushDeviceToken.push(temp);
    }
  }
  // console.log(allPushDeviceToken);
  var senderName=newMessageResult.nickName;
  var sendMessage=newMessageResult.message;
  var groupName=await getRoomName(roomID);
  for(var x in allPushDeviceToken){
    var deviceToken=allPushDeviceToken[x];
    await sending(senderName,sendMessage,deviceToken,groupName);//發送推播
  }
  return ;
}
//取得該聊天室所影有成員>排除發送者>取出其於用戶devicetoken>發送推播
function getAllPushMember(roomID,senderId){
  var selectStr='select * from groups where id=?';
  var memberArr=[];
  return new Promise(async function(resolve,reject){
    connectdb.query(selectStr,roomID,function(err,rows){
      if(!err){
        var customerArr=rows[0].customerId.split(',');
        memberArr.push(rows[0].hostId);
        for(var i in customerArr){
          if(customerArr[i]===''||customerArr===' '){
            continue;
          }
          var memberId=parseInt(customerArr[i]);
          memberArr.push(parseInt(customerArr[i]));
        }
        memberArr=memberArr.filter(function(data,index,arr){
          return (data!==senderId);
        });
        resolve(memberArr);
      }
    });
  });
}

function getMemberDeviceToken(memberId){
  var selectStr='select * from devicetokenlist where memberId=?';
  return new Promise(function(resolve,reject){
    connectdb.query(selectStr,memberId,function(err,rows){
      if(!err){
        if(rows.length===0){  //如果找無該會員devicetoken或該會員無token
          resolve(null);//則回null
          return;
        }
        if(rows[0].isLogin===0){  //判斷該會員登入狀況
          resolve(null);
        }
        resolve(rows[0].deviceToken);
      }else{
        resolve(null);
      }
    });
  });
}

function getRoomName(roomID){
  var selectStr='select * from groups where id=?';
  return new Promise(function(resolve,reject){
    connectdb.query(selectStr,roomID,function(err,rows){
      if(!err){
        resolve(rows[0].name);
      }else{
        resolve(roomID);
      }
    });
  });
}

var AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: '[AWS IAM 安全憑證訪問ID]',
  secretAccessKey: '[AWS IAM 安全憑證訪問password]',
  region: '[使用區域]'
});

var sns = new AWS.SNS();

function sending(userName,message,deviceToken,groupName){
  return new Promise(function(resolve,reject){
    sns.createPlatformEndpoint({
      PlatformApplicationArn: '[aws sns application arn]',
      Token: deviceToken
    }, function(err, data) {
      if (err) {
        console.log('err',err.stack);
        return;
      }

      var endpointArn = data.EndpointArn;
      // console.log('===',endpointArn);
      var payload = {
        default: groupName,  //title
        APNS: {
          aps: {
            alert: {  //body message
              body:"["+userName+"]"+message,
            },
            sound: 'default',
            badge: 1,
          }
        }
      };
    payload.APNS.aps.alert.title=groupName; //通知message title
    payload.APNS = JSON.stringify(payload.APNS);
    //將payload.APNS轉JSON string
    payload = JSON.stringify(payload);  //將payload轉JSON string

    console.log('sending push');
    sns.publish({
      Message: payload,
      MessageStructure: 'json',
      TargetArn: endpointArn
    }, function(err, data) {
      if (err) {
        console.log('err',err.stack);
        resolve();
        return;
      }
      console.log('push sent',data);
      resolve();
    });
  });
  });
}

exports.sendPushNotification=sendPushNotification;
