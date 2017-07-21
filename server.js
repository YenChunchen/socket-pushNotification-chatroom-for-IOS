// 'use strict';
const express = require('express');
const IO = require('socket.io');
const path = require('path');

const PORT = process.env.PORT || 3000;
const CHATROOM = path.join(__dirname, 'room.html');

const server = express()
  .use('/room',function(req, res) {
    console.log(CHATROOM);
    res.sendFile(CHATROOM);
  })
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

const socketIO = IO(server);

var sendPushNotification=require('./push.js')
var connectdb=require('./model/connectdb.js');
var moment=require('moment');


socketIO.on('connection', (socket) => {
  var userId;
  // var leaveRoomId;
  var roomID;
  socket.on('join', async function (joinInfo) {
    roomID=joinInfo.roomID;
    leaveRoomId=roomID;
    userId=joinInfo.memberID;
    var memberRaw=await memberPhotoAndName(userId);
    // var history=await showMessage(roomID);
    var joinResult={
      id:memberRaw.id,
      nickName:memberRaw.nickName,
      photoURL:memberRaw.photo,
      message:memberRaw.nickName+'已登入',
      timeStamp:moment(Date.now()+28800000).format('YYYY/MM/DD HH:mm:ss')
    };
    // console.log('joinResult',joinResult);
    socket.join(roomID);    // 加入房间,將當前使用者加到socket branch(該URL roomID)裡面
    socketIO.to(roomID).emit('join', joinResult);
  });

  socket.on('disconnect', async function () {
    var memberRaw=await memberPhotoAndName(userId);
    var leaveResult={
      id:memberRaw.id,
      nickName:memberRaw.nickName,
      photoURL:memberRaw.photo,
      message:memberRaw.nickName+'退出了房间',
      timeStamp:moment(Date.now()+28800000).format('YYYY/MM/DD HH:mm:ss')
    };
    // console.log('leaveResult',leaveResult);
    socket.leave(roomID);  // 退出房间,將當前使用者離開socket branch(該URL roomID)裡面
    socketIO.to(roomID).emit('disconnect',leaveResult);
  });
  // 接收用户消息,发送相应的房间
  socket.on('message', async function (messageInfo) {
    var memberRaw=await memberPhotoAndName(messageInfo.memberID);  //取得該留言userId資料
    var newMessageResult={
        id:memberRaw.id,
        nickName:memberRaw.nickName,
        photoURL:memberRaw.photo
    };
    var newMessageId=await createMessage(messageInfo.memberID,messageInfo.roomID,messageInfo.message); //新增訊息並取得該ID
    var newMessage=await getNewMessage(newMessageId);//取的該筆新訊息詳細資訊
    newMessageResult.message=newMessage.message;
    newMessageResult.timeStamp=newMessage.messageTime;
    // console.log('newMessageResult',newMessageResult);
    socketIO.to(messageInfo.roomID).emit('message', newMessageResult);
    // await sendPushNotification.sendPushNotification(newMessageResult,messageInfo.roomID);
  });
});


function memberPhotoAndName(memberID){
	return new Promise(function(resolve,reject){
		connectdb.query('select * from member where id=?',[memberID],function(err,rows){
			if(!err){
        if(rows.length===0){
          resolve();
          return;
        }else{
          resolve(rows[0]);
        }
			}
		});
	});
}


function showMessage(groupId){
  return new Promise(function(resolve,reject){
    connectdb.query('select * from chatroom where groupId=?  order by messageTime',[groupId],async function(err,rows){
      if(err){
        reject(err);
        return;
      }else{
        var correctArr=[];
        for(var i in rows){
          var temp={
            memberID:rows[i].memberID,
            message:rows[i].message,
            messageTime:moment(rows[i].messageTime).format('YYYY/M/D H:m:s'),
          };
					var memberInfo=await memberPhotoAndName(rows[i].memberID);
					temp.photoURL=memberInfo.photo;
					temp.nickName=memberInfo.nickName;
          correctArr.push(temp);
        }
        resolve(correctArr);
      }
    });
  });
}

function createMessage(memberID,roomID,msg){
  var now=Date.now()+28800000;
  // console.log(moment(now).format('YYYY/MM/DD HH:mm:ss'));
	return new Promise(function(resolve,reject){
		var thismessage={
			memberID:memberID,
			groupId:roomID,
			message:msg,
      messageTime:moment(now).format('YYYY/MM/DD HH:mm:ss')
		};
		// console.log('==',thismessage);
		connectdb.query('insert into chatroom set ?',[thismessage],function(err,rows){
			if(err){
				resolve(err);
				return;
			}else{
				resolve(rows.insertId);
			}
		});
	});
}
function getNewMessage(messageId){
  return new Promise(function(resolve,reject){
    connectdb.query('select * from chatroom where id=?',[messageId],async function(err,rows){
      if(err){
        resolve(err);
        return;
      }else{
				var correctArr=[];
				var temp={
					message:rows[0].message,
					messageTime:moment(Date.now()).format('YYYY/M/D HH:mm:ss'),
				};
				resolve(temp);
      }
    });
  });
}
