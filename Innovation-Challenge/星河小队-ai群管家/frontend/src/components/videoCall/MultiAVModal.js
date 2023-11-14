import React from 'react'
import { connect } from 'react-redux'
import WebIM from '@/config/WebIM'
import Draggable from 'react-draggable'
import { message, Row, Col, Modal } from 'antd'
import VideoCallActions from '@/redux/VideoCallRedux'
import Immutable from 'seamless-immutable'
import { store } from '@/redux'
import narrow from '@/themes/img/narrow@2x.png'
import microphone from '@/themes/img/microphone@2x.png'
import microphoneMute from '@/themes/img/microphone-mute@2x.png'
import inviteMember from '@/themes/img/invite_member@2x.png'
import hangup from '@/themes/img/hangupCall@2x.png'
import camera from '@/themes/img/camera@2x.png'
import cameraClose from '@/themes/img/camera-close@2x.png'
import videobg from '@/themes/img/video-bg@2x.png'
import videold from '@/themes/img/video-loading@2x.png'
import talkingicon from '@/themes/img/talking@2x.png'
const confirm = Modal.confirm
const rtc = WebIM.rtc;
const AgoraRTC = WebIM.AgoraRTC;

class MultiAVModal extends React.Component {
	constructor(props) {
        super()

        this.state = {
        	aoff: false,
			voff: false,
			hour: 0,
            minute: 0,
            second: 0,
            span: 12,
            isTalting: []
        }
        this.loadTime = this.loadTime.bind(this)
        this.uid2userids = {}
    }

    componentDidMount(){
    	rtc.client = AgoraRTC.createClient({ mode: "live", codec: "h264" });
        rtc.client.setClientRole('host')
		this.addListener()
		this.interval()

        let {joinedMembers, invitedMembers} = this.props;
        let videos = joinedMembers.concat(invitedMembers)
        if (videos.length > 4) {
            this.setState({
                span: 6
            })
        }else{
            this.setState({
                span: 12
            })
        }
	}


	componentWillReceiveProps(props){
        if (props.callStatus == this.props.callStatus) {return}
    	if (props.callStatus === 3 && !props.confr.calleeDevId || props.callStatus === 7) {
    		// 3 主叫加入； 5 被叫加入
            console.log('callStatus', props.callStatus, props)
    		this.join()
    	}
    }

    componentWillUnmount(){
    	if (this.props.callStatus != 0) {
    		//this.props.hangup()
    	}
        this.intervalID&&clearInterval(this.intervalID)
    }


	async join(){
        const appId = WebIM.config.AgoraAppId;
        let {joinedMembers, confr} = this.props;
        let imUserName = WebIM.conn.context.jid.name
        let params = {
            username: imUserName,
            channelName: confr.channel,
            appkey: WebIM.conn.appKey
        }
        const {accessToken, agoraUserId} = await this.props.getRtctoken(params)
        this.uid2userids = await this.props.getConfDetail(params)
        const uid = await rtc.client.join(appId, confr.channel, accessToken, agoraUserId);
        console.log('会议详情 ---', this.uid2userids)
        // 通过麦克风采集的音频创建本地音频轨道对象。
        rtc.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        // 通过摄像头采集的视频创建本地视频轨道对象。
        rtc.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        // 将这些音视频轨道对象发布到频道中。
        await rtc.client.publish([rtc.localAudioTrack, rtc.localVideoTrack]);

        console.log("publish success! --- ");
        let videoElm = 'video' + WebIM.conn.context.jid.name;
        this.props.setJoinedMembers({videoElm: videoElm , name: imUserName, type: 'video'})

        rtc.localVideoTrack.play(videoElm);
    }


    addListener(){
    	rtc.client.on("user-published", async(user, mediaType) => {
    		console.log('有远端画面 -------- ')
    		console.log(user, mediaType)
            // 开始订阅远端用户。
            if (this.uid2userids[user.uid]) {
                user.uid2userid = this.uid2userids[user.uid]
            }else{
                let {joinedMembers, confr} = this.props;
                let imUserName = WebIM.conn.context.jid.name
                let params = {
                    username: imUserName,
                    channelName: confr.channel,
                    appkey: WebIM.conn.appKey
                }
                this.uid2userids = await this.props.getConfDetail(params)
                user.uid2userid = this.uid2userids[user.uid]
            }
            await rtc.client.subscribe(user, mediaType);
            
            console.log("subscribe success");

            let {joinedMembers, invitedMembers} = this.props;
            let videoElm = ''
            let exist = false;

            if (joinedMembers.length > 4) {
                this.setState({
                    span: 6
                })
            }else{
                this.setState({
                    span: 12
                })
            }

            joinedMembers.forEach((item, index) => {
            	if (item.name === user.uid2userid) {
            		exist = true
            		// item.type = mediaType
            		// videoElm = 'video' + index;
            	}
            })

            let joined = {}
            if (!exist) {
                joined = {
                    name: user.uid2userid,
                    videoElm: 'video' + user.uid2userid,
                    type: mediaType,
                    value: user.uid2userid,
                }
                videoElm = 'video' + user.uid2userid;
                this.props.setJoinedMembers(joined)
            }

            // 表示本次订阅的是视频。
            if (mediaType === "video") {
                // 订阅完成后，从 `user` 中获取远端视频轨道对象。
                const remoteVideoTrack = user.videoTrack;
                // 也可以只传入该 DIV 节点的 ID。
                let videoBox = videoElm?videoElm:joinedMembers.filter((item)=>(item.name == user.uid2userid))[0].videoElm
                setTimeout(() => {
                    remoteVideoTrack.play(videoBox);
                }, 100)
            }

            // 表示本次订阅的是音频。
            if (mediaType === "audio") {
                // 订阅完成后，从 `user` 中获取远端音频轨道对象。
                const remoteAudioTrack = user.audioTrack;
                // 播放音频因为不会有画面，不需要提供 DOM 元素的信息。
                remoteAudioTrack.play();
            }
        });

        // 监听远端取消发布
        rtc.client.on("user-unpublished", (user, mediaType) => {
        	console.log('取消发布了')
        });

        rtc.client.on("user-left", (user) => {
        	console.log('-- 对方已离开 ---', user)
            
            this.props.updateJoinedMembers({name: user.uid2userid})
            
            let {joinedMembers} = this.props

            if (joinedMembers.length<2) {
                this.props.hangup()
            }

            if (joinedMembers.length > 4) {
                this.setState({
                    span: 6
                })
            }else{
                this.setState({
                    span: 12
                })
            }

        })

        rtc.client.enableAudioVolumeIndicator();
        rtc.client.on("volume-indicator", (result) => {
            let isTalting = [...this.state.isTalting]
            result.forEach((volume, index) => {
                //console.log(`**** ${index} UID ${volume.uid} Level ${volume.level} ***`);
                let userId = this.uid2userids[volume.uid]
                if (volume.level > 1 && !isTalting.includes(userId)) {
                    isTalting.push(userId)
                }else{
                    if (volume.level < 1 && isTalting.includes(userId)) {
                        let i = isTalting.indexOf(userId)
                        isTalting.splice(i, 1)
                    }
                }
            });
            this.setState({isTalting})
        });
    }

    closeModal(){
    	console.log('挂断')
     	let members = [... this.props.invitedMembers]
     	if ( [1,3].includes(this.props.callStatus)) {
     		members.forEach((item) => {
     			this.props.cancelCall(item.value)
     		})
     	}

        this.props.hangup()
    }

    minisize(){
        this.props.setMinisize(true)
    }

    open_camera(){
    	this.setState({
    		voff: false
    	})
    	rtc.localVideoTrack.setEnabled(true)
    }

    close_camera(){
    	this.setState({
    		voff: true
    	})
    	rtc.localVideoTrack.setEnabled(false)
    }

    open_mic(){
    	this.setState({
    		aoff: false
    	})
    	rtc.localAudioTrack.setEnabled(true)
    }

    close_mic(){
        let isTalting = this.state.isTalting
        let imUserName = WebIM.conn.context.jid.name
        let i = isTalting.indexOf(imUserName)
        if (i > -1) {
            isTalting.splice(i, 1)
        }
    	this.setState({
    		aoff: true,
            isTalting
    	})
    	rtc.localAudioTrack.setEnabled(false)
    }

    addMember(){
    	console.log('添加')
    	this.props.showInviteModal()
    }

    loadTime(hour, minute, second) {
        const n2s = (n) => {
            let s = ''
            if (n >= 0 && n < 10) {
                s = '0' + n
            } else {
                s = n + ''
            }
            return s
        }
        let str = ''
        let hs = n2s(hour), ms = n2s(minute), ss = n2s(second)
        str = hs == '00' ? ms + ':' + ss : hs + ':' + ms + ':' + ss
        return str
    }
    interval(){
        let hour = 0, minute =0, second = 0;
        this.intervalID = setInterval( () => {
            second += 1
            if (second === 60) {
                second = 0
                minute += 1
                if (minute === 60) {
                    minute = 0
                    hour += 1
                    if (hour == 24) {
                        hour = 0
                    }
                }
            }
            let time = this.loadTime(hour, minute, second)
            this.props.setCallDuration(time)
        }, 1000)
    }

    minisize(){
        this.props.setMinisize(true)
    }

    render() {
    	let groupName = '多人会议'
    	let { voff, aoff, isTalting } = this.state
    	let streams = []

        let span = this.state.span

        let {joinedMembers, invitedMembers, minisize, callDuration} = this.props;

        let videos = joinedMembers.concat(invitedMembers)

        let classHide = minisize ? 'hide' : ''

    	return (
    		<Draggable
                defaultPosition={{ x: 300, y: 200 }}
                bounds="parent"
                >
                <div className={"multi-webim-rtc "+ classHide}>
                    <div className="groupname">
                        <img className="narrow" src={narrow} alt="" onClick={()=>{this.minisize()}}/>
                    </div>

                    <Row gutter={2}>
                        {
                            videos.map(
                                (item, index) => {
                                    let joining = item.videoElm?'':'joining'
                                    let talking = isTalting.includes(item.name)? 'istalking' : 'hide'
                                    return(
                                    <Col span={span} key={item.name || item.value}> 
                                    	<div className={'default '+joining} id={'video' + item.name}>

                                        </div>
                                    	<div className="user-name">
                                            <span>{item.name || ''}</span>
                                        </div>
                                        <div className={talking}>
                                            <img src={talkingicon} alt=""/>
                                        </div>
                                    </Col>
                                    )
                                }
                            )
                        }

                    </Row>
                    <p className="video-duration">{callDuration}</p>
	                <div className='action-wrap'>
		                <div className="tools">
		                    <img src={inviteMember} alt="" onClick={()=>{this.addMember()}}/>
                            <p>添加成员</p>
		                </div>

                        <div className="tools">
                            {
                                aoff ? 
                                <img src={microphoneMute} alt="" onClick={()=>{this.open_mic()}}/> :
                                <img src={microphone} alt="" onClick={()=>{this.close_mic()}}/>
                            }
                            <p>语音</p>
                        </div>
                        <div className="tools">
                            <img src={hangup} alt="" onClick={()=>{this.closeModal()}}/>
                            <p>挂断</p>
                        </div>
                        <div className="tools">
                            {
                                voff?
                                <img src={cameraClose} alt="" onClick={()=>{this.open_camera()}}/>:
                                <img src={camera} alt="" onClick={()=>{this.close_camera()}}/>
                            }
                            <p>视频</p>
                        </div>
	                </div>
                </div>
            </Draggable>
    	)
    }

}

export default connect(
    ({ multiAV, entities, callVideo }) => ({
        multiAV,
        byId: entities.group.byId,
        gid: callVideo.gid,
        confr: callVideo.confr,
        callStatus: callVideo.callStatus,
        joinedMembers: callVideo.joinedMembers,
        invitedMembers: callVideo.invitedMembers,
        callDuration: callVideo.callDuration,
        minisize: callVideo.minisize,
    }),
    dispatch => ({
        setJoinedMembers: (joined) => dispatch(VideoCallActions.setJoinedMembers(joined)),
        updateJoinedMembers: (removed) => dispatch(VideoCallActions.updateJoinedMembers(removed)),
        hangup: () => dispatch(VideoCallActions.hangup()),
        showInviteModal: () => dispatch(VideoCallActions.showInviteModal()),
        cancelCall: (to) => dispatch(VideoCallActions.cancelCall(to)),
        setMinisize: (isMini) => dispatch(VideoCallActions.setMinisize(isMini)),
        setCallDuration: (time) => dispatch(VideoCallActions.setCallDuration(time)),
        getRtctoken: (conf) => dispatch(VideoCallActions.getRtctoken(conf)),
        setUidToUserId: (member) => dispatch(VideoCallActions.setUidToUserId(member)),
        getConfDetail: (conf) => dispatch(VideoCallActions.getConfDetail(conf))
    })
)(MultiAVModal)

