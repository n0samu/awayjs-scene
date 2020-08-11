import { AssetEvent, IAsset, WaveAudio, AudioManager, IAssetAdapter } from "@awayjs/core";

import { PartitionBase, EntityNode } from '@awayjs/view';

import { Graphics } from "@awayjs/graphics";

import { IMovieClipAdapter } from "../adapters/IMovieClipAdapter";
import { IDisplayObjectAdapter } from "../adapters/IDisplayObjectAdapter";
import { Timeline } from "../base/Timeline";
import { MouseEvent } from "../events/MouseEvent";
import { FrameScriptManager } from "../managers/FrameScriptManager";

import { DisplayObject } from "./DisplayObject";
import { Sprite } from "./Sprite";
import { TextField } from "./TextField";
import { DisplayObjectContainer } from './DisplayObjectContainer';
import { LoaderContainer } from './LoaderContainer';

export class MovieClip extends Sprite {
	public static mcForConstructor: MovieClip;
	//todo: this 3 are no longer used (?)
	public static avm1ScriptQueue: MovieClip[] = [];
	public static avm1ScriptQueueScripts: any[] = [];
	public static avm1LoadedActions: any[] = [];



	public static movieClipSoundsManagerClass = null;

	private static _movieClips: Array<MovieClip> = new Array<MovieClip>();

	private static _activeSounds: any = {};
	
	public static assetType: string = "[asset MovieClip]";

	public static getNewMovieClip(timeline: Timeline = null): MovieClip {
		if (MovieClip._movieClips.length) {
			var movieClip: MovieClip = MovieClip._movieClips.pop()
			movieClip.timeline = timeline || new Timeline();
			movieClip.graphics = Graphics.getGraphics();
			return movieClip;
		}

		return new MovieClip(timeline);
	}

	public static clearPool() {
		MovieClip._movieClips = [];
	}
	
	public symbolID:number=0;
	public preventScript: boolean = false;
	private _timeline: Timeline;

	// buttonMode specifies if the mc has any mouse-listeners attached that should trigger showing the hand-cursor
	// if this is set once to true; it will never get set back to false again.
	private _buttonMode: boolean = false;

	// isButton specifies if the mc-timeline is actually considered a button-timeline
	private _isButton: boolean = false;

	private _onMouseOver: (event: MouseEvent) => void;
	private _onMouseOut: (event: MouseEvent) => void;
	private _onDragOver: (event: MouseEvent) => void;
	private _onDragOut: (event: MouseEvent) => void;
	private _onMouseDown: (event: MouseEvent) => void;
	private _onMouseUp: (event: MouseEvent) => void;

	private _time: number = 0;// the current time inside the animation
	private _currentFrameIndex: number = -1;// the current frame

	private _isPlaying: boolean = true;// false if paused or stopped

	private _skipAdvance: boolean;
	private _isInit: boolean = true;

	private _potentialInstances: any = {};
	private _depth_sessionIDs: Object = {};
	private _sessionID_childs: Object = {};
	private _sounds: Object = {};

	public _useHandCursor: boolean;
	
	private _parentSoundVolume: number;

	private _soundVolume: number;
	private _skipFramesForStream:number=0;

	public buttonEnabled: boolean = true;

	private _soundStreams: any;

	public initSoundStream(streamInfo: any, maxFrameNum:number) {
		if (!this._soundStreams) {
			this._soundStreams = new MovieClip.movieClipSoundsManagerClass(this);
		}
		this._soundStreams.initSoundStream(streamInfo, maxFrameNum);
	}

	public addSoundStreamBlock(frameNum: number, streamBlock: any) {
		if (!this._soundStreams) {
			this._soundStreams = new MovieClip.movieClipSoundsManagerClass(this);
		}
		this._soundStreams.addSoundStreamBlock(frameNum, streamBlock);
	}
	
	
	private stopCurrentStream(frameNum: number) {
		if (this._soundStreams) {
			//console.log("sync sounds for mc: ", this.numFrames);
			return this._soundStreams.stopStream(frameNum);
		}
	}
	private resetStreamStopped() {
		if (this._soundStreams) {
			//console.log("sync sounds for mc: ", this.numFrames);
			this._soundStreams.resetStreamStopped();
		}
	}

	private _syncSounds(frameNum: number):number {
		if (this._soundStreams) {
			//console.log("sync sounds for mc: ", this.numFrames);
			return this._soundStreams.syncSounds(frameNum, this._isPlaying, this.parent);
		}
		return 0;
	}
	constructor(timeline: Timeline = null) {
		super();

		this._soundVolume = 1;
		this._parentSoundVolume = 1;
		this.doingSwap = false;
		this._isButton = false;
		this._buttonMode = false;
		this._useHandCursor = true;
		this.cursorType = "pointer";
		//this.debugVisible=true;

		this.inheritColorTransform = true;

		this._onMouseOver = (event: MouseEvent) => {
			if (this.buttonEnabled)
				this.currentFrameIndex = 1;
			else
				this.currentFrameIndex = 0;
		};
		this._onMouseOut = (event: MouseEvent) => {
			this.currentFrameIndex = 0;
		};
		this._onMouseDown = (event: MouseEvent) => {
			if (this.buttonEnabled)
				this.currentFrameIndex = 2;
			else
				this.currentFrameIndex = 0;
		};
		this._onMouseUp = (event: MouseEvent) => {
			this.currentFrameIndex = this.currentFrameIndex == 0 ? 0 : 1;
		};
		this._onDragOver = (event: MouseEvent) => {
			if (this.buttonEnabled)
				this.currentFrameIndex = 2;
			else
				this.currentFrameIndex = 0;
		};
		this._onDragOut = (event: MouseEvent) => {
			this.currentFrameIndex = 1;
		};

		this._timeline = timeline || new Timeline();
	}

	public startSound(id: any, sound: WaveAudio, loopsToPlay: number) {
		if (this._sounds[id]) {
			this._sounds[id].stop();
		}
		sound.loopsToPlay = loopsToPlay;
		sound.play(0, false);
		this._sounds[id] = sound;
		if (!MovieClip._activeSounds[id])
			MovieClip._activeSounds[id] = [];
		MovieClip._activeSounds[id].push(sound);
	}
	public stopSounds(soundID: any = null) {
		if (soundID) {
			if (this._sounds[soundID]) {
				this._sounds[soundID].stop();
				delete this._sounds[soundID];
			}
		}
		else {
			for (var key in this._sounds) {
				this._sounds[key].stop();
			}
			this._sounds = {};
		}
		var len: number = this._children.length;
		var child: DisplayObject;
		for (var i: number = 0; i < len; ++i) {
			child = this._children[i];
			if (child.isAsset(MovieClip))
				(<MovieClip>child).stopSounds(soundID);
		}
		this.stopCurrentStream(this._currentFrameIndex);
		MovieClip._activeSounds = {};
		if (this._soundStreams) {
			this._soundStreams.syncSounds(0, false, this.parent);
		}
	}
	public get isPlaying(): boolean {
		return this._isPlaying;
	}
	public get soundVolume(): number {
		return this._soundVolume;
	}
	public set soundVolume(value: number) {
		if (this._soundVolume == value) {
			return;
		}
		this._soundVolume = value;
		for (var key in this._sounds) {
			this._sounds[key].volume = value;
		}
		var len: number = this._children.length;
		var child: DisplayObject;
		for (var i: number = 0; i < len; ++i) {
			child = this._children[i];
			if (child.isAsset(MovieClip))
				(<MovieClip>child).soundVolume = value;
		}
	}
	public stopSound(id: number) {
		if (this._sounds[id]) {
			this._sounds[id].stop();
			delete this._sounds[id];
		}
		if (MovieClip._activeSounds[id]) {
			for (var i: number = 0; i < MovieClip._activeSounds[id].length; i++) {
				MovieClip._activeSounds[id][i].stop();
			}
			delete MovieClip._activeSounds[id];
		}
	}
	public buttonReset() {
		if (this._isButton && !this.buttonEnabled) {
			this.currentFrameIndex = 0;
		}
	}

	public getMouseCursor(): string {
		if (this.name == "scene")
			return "initial";
		if (this._useHandCursor && this.buttonMode) {
			return this.cursorType;
		}
		return "initial";
        /*
		var cursorName:string;
		var parent:DisplayObject=this.parent;
		while(parent){
			if(parent.isAsset(MovieClip)){
				cursorName=(<MovieClip>parent).getMouseCursor();
				if(cursorName!="initial"){
					return cursorName;
				}
			}
			parent=parent.parent;
			if(parent && parent.name=="scene"){
				return "initial";
			}
		}
        return "initial";
        */
	}
	public registerScriptObject(child: DisplayObject): void {
		this[child.name] = child;

		if (child.isAsset(MovieClip))
			(<MovieClip>child).removeButtonListeners();
	}
	public unregisterScriptObject(child: DisplayObject): void {
		delete this[child.name];

		if (child.isAsset(MovieClip))
			(<MovieClip>child).removeButtonListeners();
	}
	public dispose(): void {
		this.disposeValues();

		MovieClip._movieClips.push(this);
	}

	public disposeValues(): void {
		super.disposeValues();

		this._potentialInstances = {};
		this._depth_sessionIDs = {};
		this._sessionID_childs = {};

		this._timeline = null;
	}

	public reset_textclones(): void {
		if (this.timeline) {
			//var len:number = this._potentialInstances.length;
			for (var key in this._potentialInstances) {
				if (this._potentialInstances[key] != null) {
					if (this._potentialInstances[key].isAsset(TextField)) {
						(<TextField>this._potentialInstances[key]).text = (<TextField>this.timeline.getPotentialChildPrototype(parseInt(key))).text;
					}
					else if (this._potentialInstances[key].isAsset(MovieClip))
						(<MovieClip>this._potentialInstances[key]).reset_textclones();
				}
			}
		}
	}

	public get useHandCursor(): boolean {
		return this._useHandCursor;
	}
	public set useHandCursor(value: boolean) {
		this._useHandCursor = value;
	}
	public get buttonMode(): boolean {
		return this._buttonMode;
	}
	public set buttonMode(value: boolean) {
		this._buttonMode = value;
	}
	public get isButton(): boolean {
		return this._isButton;
	}
	public set isButton(value: boolean) {
		this._isButton = value;
	}
	public get isInit(): boolean {
		return this._isInit;
	}
	public set isInit(value: boolean) {
		this._isInit = value;
	}

	public get timeline(): Timeline {
		return this._timeline;
	}

	public set timeline(value: Timeline) {
		if (this._timeline == value)
			return;

		this._timeline = value;

		this.reset(false);
	}

	/**
	 *
	 */
	public loop: boolean = true;

	public get numFrames(): number {
		return this._timeline.numFrames;
	}

	public jumpToLabel(label: string, offset: number = 0): void {
		// the timeline.jumpTolabel will set currentFrameIndex
		this._timeline.jumpToLabel(this, label, offset);
	}

	/**
	 * the current index of the current active frame
	 */
	public constructedKeyFrameIndex: number = -1;

	public reset(fireScripts: boolean = true): void {
		super.reset();

		this.resetStreamStopped();

		// time only is relevant for the root mc, as it is the only one that executes the update function
		this._time = 0;
		//this.stopSounds();

		if (this._adapter)
			(<IMovieClipAdapter>this.adapter).freeFromScript();

		this.constructedKeyFrameIndex = -1;
		for (var i: number = this.numChildren - 1; i >= 0; i--)
			this.removeChildAt(i);

		this.graphics.clear();




		if (fireScripts) {
			var numFrames: number = this._timeline.keyframe_indices.length;
			this._isPlaying = Boolean(numFrames > 1);
			if (numFrames) {
				this._currentFrameIndex = 0;
				// contruct the timeline and queue the script.
				//if(fireScripts){
				this._timeline.constructNextFrame(this, fireScripts && !this.doingSwap && !this.preventScript, true);
				//}
			} else {
				this._currentFrameIndex = -1;
			}
		}
		// prevents the playhead to get moved in the advance frame again:	
		this._skipAdvance = true;
		//FrameScriptManager.execute_queue();


	}


	public resetSessionIDs(): void {
		this._depth_sessionIDs = {};
	}

	/*
	* Setting the currentFrameIndex will move the playhead for this movieclip to the new position
	 */
	public get currentFrameIndex(): number {
		return this._currentFrameIndex;
	}

	public set currentFrameIndex(value: number) {
		var queue_script: boolean = true;

		var numFrames: number = this._timeline.keyframe_indices.length;

		this.resetStreamStopped();
		if (!numFrames)
			return;

		if (value < 0) {
			value = 0;
		} else if (value >= numFrames) {
			// if value is greater than the available number of
			// frames, the playhead is moved to the last frame in the timeline.
			// In this case the frame specified is not considered a keyframe, 
			// no scripts should be executed in this case
			value = numFrames - 1;
			queue_script = false;
		}


		this._skipAdvance = false;
		if (this._currentFrameIndex == value)
			return;

		this._currentFrameIndex = value;

		//console.log("_currentFrameIndex ", this.name, this._currentFrameIndex);
		//changing current frame will ignore advance command for that
		//update's advanceFrame function, unless advanceFrame has
		//already been executed

		this._timeline.gotoFrame(this, value, queue_script, false, true);
	}

	public addButtonListeners(): void {
		this._isButton = true;

		this.stop();

		this.addEventListener(MouseEvent.MOUSE_OVER, this._onMouseOver);
		this.addEventListener(MouseEvent.MOUSE_OUT, this._onMouseOut);
		this.addEventListener(MouseEvent.MOUSE_DOWN, this._onMouseDown);
		this.addEventListener(MouseEvent.MOUSE_UP, this._onMouseUp);
		this.addEventListener(MouseEvent.DRAG_OVER, this._onDragOver);
		this.addEventListener(MouseEvent.DRAG_OUT, this._onDragOut);

		this.mouseChildren = false;
	}

	public removeButtonListeners(): void {
		this.removeEventListener(MouseEvent.MOUSE_OVER, this._onMouseOver);
		this.removeEventListener(MouseEvent.MOUSE_OUT, this._onMouseOut);
		this.removeEventListener(MouseEvent.MOUSE_DOWN, this._onMouseDown);
		this.removeEventListener(MouseEvent.MOUSE_UP, this._onMouseUp);
		this.removeEventListener(MouseEvent.DRAG_OVER, this._onDragOver);
		this.removeEventListener(MouseEvent.DRAG_OUT, this._onDragOut);
	}

	public getChildAtSessionID(sessionID: number): DisplayObject {
		return this._sessionID_childs[sessionID];
	}

	public getSessionIDDepths(): Object {
		return this._depth_sessionIDs;
	}

	public swapChildrenAt(index1: number, index2: number): void {
		var depth: number = this._children[index2]._depthID;
		var child: DisplayObject = this._children[index1];

		this.doingSwap = true;
		this.addChildAtDepth(this._children[index2], this._children[index1]._depthID);
		this.addChildAtDepth(child, depth);
		this._depth_sessionIDs[depth] = child._sessionID;
		this._depth_sessionIDs[this._children[index1]._depthID] = this._children[index2]._sessionID;
		this.doingSwap = false;
	}
	public swapDepths(child: DisplayObject, depth: number) {

		var existingChild: DisplayObject = this.getChildAtDepth(depth);
		var currentDepth: number = child._depthID;
		if (currentDepth == depth) {
			return;
		}
		delete this._depth_sessionIDs[currentDepth];
		this._depth_sessionIDs[depth] = child._sessionID;
		this.doingSwap = true;
		super.removeChildAtDepth(currentDepth);
		if (existingChild) {
			super.removeChildAtDepth(depth);
			super.addChildAtDepth(existingChild, currentDepth);
		}
		super.addChildAtDepth(child, depth);
		this.doingSwap = false;

	}

	public _addTimelineChildAt(child: DisplayObject, depth: number, sessionID: number): DisplayObject {
		this._depth_sessionIDs[depth] = child._sessionID = sessionID;
		(<any>child).addedByTimeline=true;

		if (child.adapter != child && (<any>child.adapter).deleteOwnProperties) {
			(<any>child.adapter).deleteOwnProperties();
        }
        if (!this.doingSwap) {
			child.reset();// this takes care of transform and visibility
		}
		(<any>child).just_added_to_timeline=true;
		var returnObj=this.addChildAtDepth(child, depth);
		this._sessionID_childs[sessionID] = child;
		//console.log(this.name, this.id, "addchild at ", depth, child.id)
		return returnObj
	}

	public finalizeTimelineConstruction() {

	}

	public removeChildAtInternal(index: number): DisplayObject {
		var child: DisplayObject = this._children[index];

		if (!this.doingSwap) {
			if (child._adapter)
				(<IMovieClipAdapter>child.adapter).freeFromScript();

			(<IMovieClipAdapter>this.adapter).unregisterScriptObject(child);
		}

		//check to make sure _depth_sessionIDs wasn't modified with a new child
		//if (this._depth_sessionIDs[child._depthID] == child._sessionID)
		//delete this._depth_sessionIDs[child._depthID];

		delete this._sessionID_childs[child._sessionID];

		if (!this.doingSwap) {
			child._sessionID = -1;
		}
		else {
			child._sessionID = -2;

		}
		if(child.adapter && (<any>child.adapter).dispatchStaticEvent){
			(<any>child.adapter).dispatchStaticEvent("removed", child.adapter);
		}
		if(this.isOnDisplayList() && (<any>child.adapter).dispatch_REMOVED_FROM_STAGE){
			(<any>child.adapter).dispatch_REMOVED_FROM_STAGE(<DisplayObjectContainer>child);
		}

		return super.removeChildAtInternal(index);
	}



	public get assetType(): string {
		return MovieClip.assetType;
	}


	/**
	 * Starts playback of animation from current position
	 */
	public play(): void {
		if (this._timeline.keyframe_indices.length > 1)
			this._isPlaying = true;
	}

	/**
	 * should be called right before the call to away3d-render.
	 */
	public update(dt: number = 0): void {
		this.advanceFrame();
	}

	public getPotentialChildInstance(id: number, instanceID: string, forceClone:boolean=false): IAsset {
		if (!this._potentialInstances[id] || this._potentialInstances[id]._sessionID == -2 || 
			(this._potentialInstances[id].cloneForEveryInstance && forceClone))
			this._potentialInstances[id] = this._timeline.getPotentialChildInstance(id, instanceID);
		this._timeline.initChildInstance(<DisplayObject>this._potentialInstances[id], instanceID);
		return this._potentialInstances[id];
	}


	/**
	 * Stop playback of animation and hold current position
	 */
	public stop(): void {
		//this.stopSounds();
		this.resetStreamStopped();
		this._isPlaying = false;
	}

	public clone(): MovieClip {
		var newInstance: MovieClip = MovieClip.getNewMovieClip(this._timeline);

		this.copyTo(newInstance);

		return newInstance;
	}

	public copyTo(movieClip: MovieClip): void {
		super.copyTo(movieClip);
		movieClip.loop = this.loop;
		movieClip._soundStreams = this._soundStreams;
		movieClip.symbolID=this.symbolID;

	}
	public advanceFrameInternal(): void {

		// if this._skipadvance is true, the mc has already been moving on its timeline this frame
		// this happens for objects that have been newly added to parent
		// they still need to queue their scripts

		//if(this._timeline && this._timeline.numFrames>0)
		if (this._timeline && this._timeline.numFrames > 0 && this._isPlaying && !this._skipAdvance) {
			if (this._currentFrameIndex == this._timeline.keyframe_indices.length - 1) {
				if (this.loop) {
					// end of loop - jump to first frame.
					if (this._currentFrameIndex == 0) {
						// do nothing if we are already on frame 1
					}
					else {
						this._currentFrameIndex = 0;
						this.resetStreamStopped();
						this._timeline.gotoFrame(this, 0, true, true, true);
					}
				}
				else //end of timeline, stop playing
					this._isPlaying = false;
			} else { // not end - construct next frame
				this._currentFrameIndex++;
				this._timeline.constructNextFrame(this);
			}
			//console.log("advancedFrame ", this.name, this._currentFrameIndex);
		}

		// than come the children from bottom up:
		var child: DisplayObject;
		for (var i: number = 0; i < this._children.length; i++) {

			child = this._children[i];

			if (child && child.isAsset(MovieClip)) {
				(<MovieClip>child).advanceFrame();
			}
			if (child && (child.isAsset(Sprite) || child.isAsset(LoaderContainer)) && (<Sprite>child).numChildren && (<any>child.adapter).advanceFrame) {
				(<any>child.adapter).advanceFrame();
			}
		}
		this._skipAdvance = false;
	}
	public advanceFrame(): void {
		if(this._skipFramesForStream==0){
			this.advanceFrameInternal();
		}
		/*if(this._skipFramesForStream<0){
			console.log("wait for audio to catch up");
		}*/
		this._skipFramesForStream=this._syncSounds(this._currentFrameIndex);
		while(this._skipFramesForStream>0){
			//console.log("skip frame for keeping audio stream synced");
			FrameScriptManager.execute_queue();
			this.advanceFrameInternal();
			this._skipFramesForStream=this._syncSounds(this._currentFrameIndex);
		}
	}

	// DEBUG CODE:
	logHierarchy(depth: number = 0): void {
		this.printHierarchyName(depth, this);

		var len = this._children.length;
		var child: DisplayObject;
		for (var i: number = 0; i < len; i++) {
			child = this._children[i];

			if (child.isAsset(MovieClip))
				(<MovieClip>child).logHierarchy(depth + 1);
			else
				this.printHierarchyName(depth + 1, child);
		}
	}

	printHierarchyName(depth: number, target: DisplayObject): void {
		var str = "";
		for (var i = 0; i < depth; ++i)
			str += "--";

		str += " " + target.name + " = " + target.id;
		console.log(str);
	}

	public clear(): void {
		//clear out potential instances
		this.resetStreamStopped();
		for (var key in this._potentialInstances) {
			var instance: IAsset = this._potentialInstances[key];

			//only dispose instances that are not used in script ie. do not have an instance name
			if (instance && !instance.name) {
				if (!instance.isAsset(Sprite)) {
					FrameScriptManager.add_child_to_dispose(<DisplayObject>instance);

				}
				delete this._potentialInstances[key];
			}
		}

		super.clear();
	}
}

PartitionBase.registerAbstraction(EntityNode, MovieClip);
