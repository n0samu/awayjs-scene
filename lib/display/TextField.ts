import { ColorUtils, Matrix, Rectangle, Point, Vector3D, AssetEvent } from '@awayjs/core';

import { ImageSampler, Float2Attributes } from '@awayjs/stage';

import { IEntityTraverser, PartitionBase, EntityNode } from '@awayjs/view';

import { Style, TriangleElements } from '@awayjs/renderer';

import { MaterialBase } from '@awayjs/materials';

import { Graphics, Shape, GraphicsFactoryHelper, MaterialManager } from '@awayjs/graphics';

import { TesselatedFontTable } from '../text/TesselatedFontTable';
import { AntiAliasType } from '../text/AntiAliasType';
import { GridFitType } from '../text/GridFitType';
import { TextFieldAutoSize } from '../text/TextFieldAutoSize';
import { TextFieldType } from '../text/TextFieldType';
import { TextFormat } from '../text/TextFormat';
import { TextInteractionMode } from '../text/TextInteractionMode';
import { TextLineMetrics } from '../text/TextLineMetrics';
import { KeyboardEvent } from '../events/KeyboardEvent';
import { TextfieldEvent } from '../events/TextfieldEvent';

import { DisplayObject } from './DisplayObject';
import { DisplayObjectContainer } from './DisplayObjectContainer';
import { Sprite } from './Sprite';
import { TextSprite } from './TextSprite';
import { TextShape } from '../text/TextShape';
import { ITextfieldAdapter } from '../adapters/ITextfieldAdapter';
import { HTMLTextProcessor } from '../text/HTMLTextProcessor';
import { TextFormatAlign } from '../text/TextFormatAlign';
import { MouseEvent } from '../events/MouseEvent';
import { Settings } from '../Settings';

interface IWord {
	start: number;
	x: number;
	y: number;
	width: number;
	len: number;
}

interface IRunEntry {
	start: number,
	count: number,
	width: number,
	space: number
}

class WordStore {
	store: Array<IWord>;
	index: number = -1;

	constructor(size = 40) {
		this.store = Array.from({ length:  size }, e => ({
			x: Infinity, y: Infinity, start: 0, width: 0, len: 0
		}));
	}

	public put (
		start: number,
		x: number,
		y: number,
		width: number,
		len: number
	): IWord {
		this.index++;

		const word = this.store [this.index] || (this.store [this.index] = {} as IWord);

		word.start = start;
		word.x = x;
		word.y = y;
		word.width = width;
		word.len = len;

		return word;
	}

	public get last(): IWord {
		return this.store[this.index];
	}

	public get length () {
		return this.index + 1;
	}

	public set length (v: number) {
		this.index = v - 1;
	}

	public get (index: number) {
		return this.store[index];
	}

	public free() {
		this.index = -1;
	}

	public dispose() {
		this.store = null;
		this.index = 0;
	}
}

const enum CHAR_CODES {
	TAB = 9,
	LF = 10,
	CR = 13,
	SPACE = 32,
	BS = 92,
	N = 110,
	R = 114,
}

const MNEMOS = [
	{
		test: /&apos;/g,
		replace: '\''
	},
	{
		test: /&gt;/g,
		replace: '>'
	}
];

/**
 * The TextField class is used to create display objects for text display and
 * input. <ph outputclass="flexonly">You can use the TextField class to
 * perform low-level text rendering. However, in Flex, you typically use the
 * Label, Text, TextArea, and TextInput controls to process text. <ph
 * outputclass="flashonly">You can give a text field an instance name in the
 * Property inspector and use the methods and properties of the TextField
 * class to manipulate it with ActionScript. TextField instance names are
 * displayed in the Movie Explorer and in the Insert Target Path dialog box in
 * the Actions panel.
 *
 * <p>To create a text field dynamically, use the <code>TextField()</code>
 * constructor.</p>
 *
 * <p>The methods of the TextField class let you set, select, and manipulate
 * text in a dynamic or input text field that you create during authoring or
 * at runtime. </p>
 *
 * <p>ActionScript provides several ways to format your text at runtime. The
 * TextFormat class lets you set character and paragraph formatting for
 * TextField objects. You can apply Cascading Style Sheets(CSS) styles to
 * text fields by using the <code>TextField.styleSheet</code> property and the
 * StyleSheet class. You can use CSS to style built-in HTML tags, define new
 * formatting tags, or apply styles. You can assign HTML formatted text, which
 * optionally uses CSS styles, directly to a text field. HTML text that you
 * assign to a text field can contain embedded media(movie clips, SWF files,
 * GIF files, PNG files, and JPEG files). The text wraps around the embedded
 * media in the same way that a web browser wraps text around media embedded
 * in an HTML document. </p>
 *
 * <p>Flash Player supports a subset of HTML tags that you can use to format
 * text. See the list of supported HTML tags in the description of the
 * <code>htmlText</code> property.</p>
 *
 * @event change                    Dispatched after a control value is
 *                                  modified, unlike the
 *                                  <code>textInput</code> event, which is
 *                                  dispatched before the value is modified.
 *                                  Unlike the W3C DOM Event Model version of
 *                                  the <code>change</code> event, which
 *                                  dispatches the event only after the
 *                                  control loses focus, the ActionScript 3.0
 *                                  version of the <code>change</code> event
 *                                  is dispatched any time the control
 *                                  changes. For example, if a user types text
 *                                  into a text field, a <code>change</code>
 *                                  event is dispatched after every keystroke.
 * @event link                      Dispatched when a user clicks a hyperlink
 *                                  in an HTML-enabled text field, where the
 *                                  URL begins with "event:". The remainder of
 *                                  the URL after "event:" is placed in the
 *                                  text property of the LINK event.
 *
 *                                  <p><b>Note:</b> The default behavior,
 *                                  adding the text to the text field, occurs
 *                                  only when Flash Player generates the
 *                                  event, which in this case happens when a
 *                                  user attempts to input text. You cannot
 *                                  put text into a text field by sending it
 *                                  <code>textInput</code> events.</p>
 * @event scroll                    Dispatched by a TextField object
 *                                  <i>after</i> the user scrolls.
 * @event textInput                 Flash Player dispatches the
 *                                  <code>textInput</code> event when a user
 *                                  enters one or more characters of text.
 *                                  Various text input methods can generate
 *                                  this event, including standard keyboards,
 *                                  input method editors(IMEs), voice or
 *                                  speech recognition systems, and even the
 *                                  act of pasting plain text with no
 *                                  formatting or style information.
 * @event textInteractionModeChange Flash Player dispatches the
 *                                  <code>textInteractionModeChange</code>
 *                                  event when a user changes the interaction
 *                                  mode of a text field. for example on
 *                                  Android, one can toggle from NORMAL mode
 *                                  to SELECTION mode using context menu
 *                                  options
 */
export class TextField extends DisplayObjectContainer {
	private _isEntity: boolean = false;
	private _onGraphicsInvalidateDelegate: (event: AssetEvent) => void;
	private _onClipboardPasteDelegate: (event: ClipboardEvent) => void;

	private static _textFields: Array<TextField> = [];

	public static assetType: string = '[asset TextField]';

	public static getNewTextField(): TextField {
		return (TextField._textFields.length) ? TextField._textFields.pop() : new TextField();
	}

	public static clearPool() {
		TextField._textFields = [];
	}

	private static _onChangedEvent = new TextfieldEvent(TextfieldEvent.CHANGED);

	public textOffsetX: number = 0;
	public textOffsetY: number = 0;
	private _width: number;
	private _height: number;
	private _graphics: Graphics;
	private _bottomScrollV: number;
	private _caretIndex: number;
	private _maxScrollH: number;
	private _maxScrollV: number;
	private _numLines: number;
	private _selectionBeginIndex: number = 0;
	private _selectionEndIndex: number = 0;
	private _biggestLine: number=0;

	/**
	 * Renderable text, used for computing a glyphs
	 * @private
	 */
	private _iText: string = '';

	/**
	 * Place where is diff is begun to end
	 * @private
	 */
	private _iTextDiffStart = 0;

	/**
	 * Original text passed to field
	 * @private
	 */
	private _text: string = '';
	private _iTextWoLineBreaks: string = ''; // _iText without line breaks
	private _textInteractionMode: TextInteractionMode;

	private _textWidth: number;
	private _textHeight: number;

	private _charBoundaries: Rectangle;
	private _firstCharInParagraph: number;
	private _imageReference: DisplayObject
	private _lineMetrics: TextLineMetrics;
	private _paragraphLength: number;

	public _textFormat: TextFormat;
	public _newTextFormat: TextFormat;
	public _textFormats: TextFormat[];
	public _textFormatsIdx: number[];

	public textShapes: StringMap<TextShape>;

	private inMaskMode: boolean = false;
	private maskChild: Sprite;
	private textChild: TextSprite;
	private targetGraphics: Graphics;

	private cursorShape: Shape;
	private bgShapeSelect: Shape;

	private cursorIntervalID: number = -1;

	public cursorBlinking: boolean = false;
	public showSelection: boolean = false;

	public _textDirty: Boolean = false;
	public _positionsDirty: Boolean = false;
	public _glyphsDirty: Boolean = false;
	public _shapesDirty: Boolean = false;
	public _textShapesDirty: Boolean = false;

	public chars_codes: number[] = [];
	public chars_width: number[] = [];
	public tf_per_char: TextFormat[] = [];

	// stores offset and length and width for each word
	public words: WordStore = new WordStore(10);

	// Amount of words that was before call reconstuct
	/*internal*/ _lastWordsCount: number;

	private _textRuns_formats: TextFormat[]=[];	// stores textFormat for each textrun
	// stores words-offset, word-count and width for each textrun
	private _textRuns_words: Array<IRunEntry> = [];
	private _paragraph_textRuns_indices: number[]=[];	// stores textFormat for each textrun

	private _maxWidthLine: number=0;

	private _labelData: any=null;

	public html: boolean;

	private lines_wordStartIndices: number[] = [];
	private lines_wordEndIndices: number[] = [];
	private lines_start_y: number[] = [];
	private lines_start_x: number[] = [];
	private lines_charIdx_start: number[] = [];
	private lines_charIdx_end: number[] = [];
	private lines_width: number[] = [];
	private lines_height: number[] = [];
	private lines_numSpacesPerline: number[] = [];
	private char_positions_x: number[] = [];
	private char_positions_y: number[] = [];

	// keeping track of the original textfield that was used for cloning this one.
	public sourceTextField: TextField=null;

	private _maskWidth: number=0;
	private _maskHeight: number=0;
	private _maskTextOffsetX: number=0;
	private _maskTextOffsetY: number=0;

	public bgShape: Shape;

	public isStatic: boolean=false;

	public updateMaskMode() {
		// mask needed
		if (this.inMaskMode) {
			if (this._maskWidth != this._width || this._maskHeight != this._height ||
					this._maskTextOffsetX != this.textOffsetX || this._maskTextOffsetY != this.textOffsetY) {

				this._maskWidth = this._width;
				this._maskHeight = this._height;
				this._maskTextOffsetX = this.textOffsetX;
				this._maskTextOffsetY = this.textOffsetY;
				this.maskChild.graphics.clear();
				this.maskChild.graphics.beginFill(0xffffff);
				this.maskChild.graphics.drawRect(this.textOffsetX, this.textOffsetY, this._width, this._height);
				this.maskChild.graphics.endFill();
			}
			this._graphics.clear();
		}
		if (!this.inMaskMode) {
			// 	masking already setup
			// 	just make sure the mask has correct size
			this.inMaskMode = true;
			if (!this.maskChild)
				this.maskChild = new Sprite();
			if (!this.textChild)
				this.textChild = new TextSprite();
			this.textChild.mouseEnabled = false;
			this.textChild.parentTextField = this;
			this.maskChild.mouseEnabled = false;
			this.maskChild.graphics.beginFill(0xffffff);
			this.maskChild.graphics.drawRect(this.textOffsetX, this.textOffsetY, this._width, this._height);
			this.maskChild.graphics.endFill();
			this.addChild(this.maskChild);
			this.addChild(this.textChild);
			this.maskChild.maskMode = true;
			//this.textChild.masks = [this.maskChild];

			this._graphics.clear();
			this.targetGraphics = this.textChild.graphics;
			return;
		}
		// only use masking if needed:
		if (this._textWidth > this._width || this._textHeight > this._height) {
			this.textChild.masks = [this.maskChild];
		} else {
			this.textChild.masks = null;
		}
		return;
	}

	public getMouseCursor(): string {
		return this.cursorType;
	}

	public get isInFocus(): boolean {
		return this._isInFocus;
	}

	public set isInFocus(value: boolean) {
	}

	public setFocus(value: boolean, fromMouseDown: boolean = false, sendSoftKeyEvent: boolean = true) {

		if (this._isInFocus == value) {
			return;
		}
		super.setFocus(value, fromMouseDown, sendSoftKeyEvent);

		this.enableInput(value);

		if (!this._selectable) {
			return;
		}

		// if (value) {
		// 	this.setSelection(0, this._iText.length);

		// 	// check if a adapter exists
		// 	if (sendSoftKeyEvent && this.adapter != this) {
		// 		// todo: create a ITextFieldAdapter, so we can use selectText() without casting to any
		// 		(<any> this.adapter).selectTextField(fromMouseDown);
		// 	}
		// } else {
		// 	this.setSelection(0, 0);
		// }
		this.setSelection(0, 0);

		this._glyphsDirty = true;
		this._invalidateEntity();
	}

	private enableInput(enable: boolean = true) {
		if (this.cursorIntervalID >= 0) {
			window.clearInterval(this.cursorIntervalID);
			this.cursorIntervalID = -1;
		}

		if (enable && this._isInFocus && this.selectable) {
			this.drawSelectionGraphics();
			const myThis = this;
			this.cursorIntervalID = window.setInterval(function() {
				myThis.cursorBlinking = !myThis.cursorBlinking;
				if (!myThis.selectable) {
					myThis.cursorBlinking = true;
				}
				myThis._shapesDirty = true;
				myThis.invalidate();
			}, 500);
		}

		// FFUUU, this not working because we prevent events, and Ctrl + V/C not bubbled to document
		// will use mannual handling a Ctrl + V/C
		/*
		if (enable) {
			document.addEventListener('paste', this._onClipboardPasteDelegate);
		} else {
			document.removeEventListener('paste', this._onClipboardPasteDelegate);
		}*/
	}

	public findCharIdxForMouse(event: MouseEvent): number {
		const myPoint = new Point(event.position.x, event.position.y);
		let lineIdx = this.getLineIndexAtPoint(myPoint.x, myPoint.y);
		let charIdx = this.getCharIndexAtPoint(myPoint.x, myPoint.y, lineIdx);

		if (lineIdx >= this.lines_start_x.length) {
			lineIdx = this.lines_start_x.length - 1;
		}

		if (lineIdx < 0) {
			lineIdx = 0;
		}

		if (lineIdx >= 0 && charIdx < 0 && this.lines_start_x[lineIdx] !== undefined) {
			if (myPoint.x <= this.lines_start_x[lineIdx]) {
				charIdx = this.lines_charIdx_start[lineIdx];
			} else {
				charIdx = this.lines_charIdx_end[lineIdx];
			}
		}

		if (lineIdx < 0 || charIdx < 0) {
			charIdx = 0;
		}

		return charIdx;

	}

	private startSelectionByMouseDelegate: (event) => void;
	private startSelectionByMouse(event) {
		this._selectionBeginIndex = this.findCharIdxForMouse(event);
		this._selectionEndIndex = this._selectionBeginIndex;

		if (this.cursorShape) this.cursorShape.invalidate();
		this.cursorShape = undefined;
		if (this.bgShapeSelect) this.bgShapeSelect.invalidate();
		this.bgShapeSelect = undefined;

		this._glyphsDirty = true;
		this._shapesDirty = true;
		this._textShapesDirty = true;
		this.cursorBlinking = false;
		this.drawSelectionGraphics();
	}

	private stopSelectionByMouseDelegate: (event) => void;
	private stopSelectionByMouse(event) {
		this._selectionEndIndex = this.findCharIdxForMouse(event);
		//console.log("stopSelectionByMouse", this._selectionBeginIndex, this._selectionEndIndex);
		this._glyphsDirty = true;
		this.reConstruct();
		this.drawSelectionGraphics();

	}

	private updateSelectionByMouseDelegate: (event) => void;
	private updateSelectionByMouse(event) {
		this._selectionEndIndex = this.findCharIdxForMouse(event);

		if (this.bgShapeSelect) this.bgShapeSelect.invalidate();
		this.bgShapeSelect = undefined;

		//console.log("updateSelectionByMouse", this._selectionBeginIndex, this._selectionEndIndex);
		this._glyphsDirty = true;
		this.reConstruct();
		this.drawSelectionGraphics();

	}

	private drawSelectionGraphics() {
		if (this._selectionBeginIndex < 0) {
			this._selectionBeginIndex = 0;
		}

		if (this._selectionBeginIndex > this.char_positions_x.length) {
			this._selectionBeginIndex = this.char_positions_x.length;
		}

		if (this._selectionEndIndex < 0) {
			this._selectionEndIndex = 0;
		}

		if (this._selectionEndIndex > this.char_positions_x.length) {
			this._selectionEndIndex = this.char_positions_x.length;
		}

		if (this._selectionBeginIndex === this._selectionEndIndex) {
			this.showSelection = false;
			this.drawCursor();
		} else {
			this.showSelection = true;
			this.cursorBlinking = true; // disable cursor if text select mode
			this.drawSelectedBG();
		}

	}

	private scrollToCursor(x, y) {
		// if(!this.textChild){
		//     return;
		// }
		// if(x>this._width){
		//     this.textChild.x-=10;
		// }
		// if(x<Math.abs(this.textChild.x)){
		//     this.textChild.x=this.textChild.x+x+2;
		// }
		// if(this.textChild.x<(this._width-this.textChild.width)){
		//     this.textChild.x=this._width-this.textChild.width;
		// }
		// if(this.textChild.x>0){
		//     this.textChild.x=0;
		// }
	}

	private drawCursor() {
		this._shapesDirty = true;

		if (this.cursorBlinking || !this.selectable || this.selectionBeginIndex !== this.selectionEndIndex) {
			return;
		}

		let x: number = 0;
		let y: number = 0;
		let tf: TextFormat = this.newTextFormat;

		if (this.char_positions_x.length == 0) {
			x = this.textOffsetX + (this._width / 2) + this._textWidth / 2;
			if (tf.align == 'justify') {
				// do nothing
			} else if (tf.align == 'center') {
				// do nothing
			} else if (tf.align == 'right') {
				x = this.textOffsetX + this._width - 2;
			} else if (tf.align == 'left') {
				x = this.textOffsetX + 4 + this._textWidth;
			}
		} else if (this._selectionBeginIndex == this.char_positions_x.length) {
			x = this.char_positions_x[this._selectionBeginIndex - 1] + this.chars_width[this._selectionBeginIndex - 1];
			y = this.char_positions_y[this._selectionBeginIndex - 1];
			tf = this.tf_per_char[this._selectionBeginIndex - 1];
		} else {
			x = this.char_positions_x[this._selectionBeginIndex];
			y = this.char_positions_y[this._selectionBeginIndex];
			tf = this.tf_per_char[this._selectionBeginIndex];
		}

		tf.font_table.initFontSize(tf.size);
		const height: number = tf.font_table.getLineHeight();
		const color = this.getTextColorForTextFormat(tf);
		let cursorScale: number = this.internalScale.x;

		if (cursorScale <= 0) {
			cursorScale = 1;
		}

		const cursorRect = [x - (0.5 * cursorScale),y,cursorScale,height];

		if (!this.cursorShape) {
			this.cursorShape = GraphicsFactoryHelper.drawRectangles(cursorRect,color,1);
			this.cursorShape.usages++;//TODO: get rid of this memory lea
		} else {
			GraphicsFactoryHelper.updateRectanglesShape(this.cursorShape, cursorRect);
		}

		if (this.cursorShape.style.color !== color) {
			const alpha = ColorUtils.float32ColorToARGB(color)[0];

			const obj = MaterialManager.get_material_for_color(color, (alpha / 255) || 1);

			if (obj.colorPos) {
				this.cursorShape.style = new Style();
				const sampler: ImageSampler = new ImageSampler();
				obj.material.animateUVs = true;
				this.cursorShape.style.color = color;
				this.cursorShape.style.addSamplerAt(sampler, obj.material.getTextureAt(0));
				this.cursorShape.style.uvMatrix = new Matrix(0, 0, 0, 0, obj.colorPos.x, obj.colorPos.y);
			}
		}
		this.scrollToCursor(x,y);

	}

	private drawSelectedBG() {
		this._shapesDirty = true;
		this._textShapesDirty = true;

		if (this._selectionBeginIndex < 0) {
			this._selectionBeginIndex = 0;
		}

		if (this._selectionBeginIndex > this.char_positions_x.length) {
			this._selectionBeginIndex = this.char_positions_x.length;
		}

		let select_start: number = this._selectionBeginIndex;
		let select_end: number = this._selectionEndIndex;

		if (this._selectionEndIndex < this._selectionBeginIndex) {
			select_start = this._selectionEndIndex;
			select_end = this._selectionBeginIndex;
		}

		let x: number = 0;
		let y: number = 0;
		let oldy: number = -1;
		let tf: TextFormat = null;
		let startx: number = -1;
		let width: number = 0;
		let height: number = 0;
		const rectangles: number[] = [];

		if (this.char_positions_x.length != 0 && this._selectionEndIndex != this._selectionBeginIndex) {
			const len: number = (select_end > this.char_positions_x.length) ? this.char_positions_x.length : select_end;
			//console.log(select_start, select_end);
			for (let i: number = select_start; i < len; i++) {

				if (i == this.char_positions_x.length) {
					x = this.char_positions_x[i - 1] + this.chars_width[i - 1];
					y = this.char_positions_y[i - 1];
					tf = this.tf_per_char[i - 1];
				} else {
					x = this.char_positions_x[i];
					y = this.char_positions_y[i];
					tf = this.tf_per_char[i];
				}
				if (startx < 0) {
					startx = x;
				}
				if (oldy >= 0 && oldy != y) {
					// new line
					rectangles.push(startx, oldy, width, height);
					width = 0;
					startx = x;
				}

				width += this.chars_width[i];
				oldy = y;
				tf.font_table.initFontSize(tf.size);

				height = Math.max(height, tf.font_table.getLineHeight());
			}
		}
		// if (this.bgShapeSelect) {
		// 	this.bgShapeSelect.dispose();
		// 	this.bgShapeSelect=null;
		// }
		if (width > 0) {
			rectangles.push(startx, oldy, width, height);

			if (!this.bgShapeSelect) {
				this.bgShapeSelect = GraphicsFactoryHelper.drawRectangles(rectangles,0x0,1);
				this.bgShapeSelect.usages++; //TODO: get rid of this memory leak
			} else {
				GraphicsFactoryHelper.updateRectanglesShape(this.bgShapeSelect,rectangles);
			}

			return;
		}

		this.scrollToCursor(startx + width,oldy + height);

	}

	public drawBG(): void {
		this._graphics.beginFill(this.backgroundColor, (!this._background) ? 0 : 1);
		this._graphics.drawRect(this.textOffsetX, this.textOffsetY, this.width, this.height);
		this._graphics.endFill();
	}

	public drawBorder(): void {
		const half_thickness_x: number = this.border ? 0.25 * this.internalScale.x : 0;
		const half_thickness_y: number = this.border ? 0.25 * this.internalScale.y : 0;
		this._graphics.beginFill(this._borderColor, 1);
		this._graphics.drawRect(this.textOffsetX, this.textOffsetY, this._width, half_thickness_y * 2);
		this._graphics.drawRect(
			this.textOffsetX, this.textOffsetY + this._height - half_thickness_y * 2,
			this._width, half_thickness_y * 2);
		this._graphics.drawRect(
			this.textOffsetX, this.textOffsetY + half_thickness_y * 2,
			half_thickness_x * 2, this._height - half_thickness_y * 2);
		this._graphics.drawRect(
			this.textOffsetX + this._width - half_thickness_x * 2,
			this.textOffsetY + half_thickness_y * 2, half_thickness_x * 2, this._height - half_thickness_y * 2);
		this._graphics.endFill();
	}

	public getTextShapeForIdentifierAndFormat(id: string, format: TextFormat) {
		if (this.textShapes[id]) {
			return this.textShapes[id];
		}

		return (this.textShapes[id] = new TextShape(format, id));
	}

	/**
	 * When set to <code>true</code> and the text field is not in focus, Flash
	 * Player highlights the selection in the text field in gray. When set to
	 * <code>false</code> and the text field is not in focus, Flash Player does
	 * not highlight the selection in the text field.
	 *
	 * @default false
	 */
	public alwaysShowSelection: boolean;

	/**
	 * The type of anti-aliasing used for this text field. Use
	 * <code>flash.text.AntiAliasType</code> constants for this property. You can
	 * control this setting only if the font is embedded(with the
	 * <code>embedFonts</code> property set to <code>true</code>). The default
	 * setting is <code>flash.text.AntiAliasType.NORMAL</code>.
	 *
	 * <p>To set values for this property, use the following string values:</p>
	 */
	public antiAliasType: AntiAliasType;

	/**
	 * Controls automatic sizing and alignment of text fields. Acceptable values
	 * for the <code>TextFieldAutoSize</code> constants:
	 * <code>TextFieldAutoSize.NONE</code>(the default),
	 * <code>TextFieldAutoSize.LEFT</code>, <code>TextFieldAutoSize.RIGHT</code>,
	 * and <code>TextFieldAutoSize.CENTER</code>.
	 *
	 * <p>If <code>autoSize</code> is set to <code>TextFieldAutoSize.NONE</code>
	 * (the default) no resizing occurs.</p>
	 *
	 * <p>If <code>autoSize</code> is set to <code>TextFieldAutoSize.LEFT</code>,
	 * the text is treated as left-justified text, meaning that the left margin
	 * of the text field remains fixed and any resizing of a single line of the
	 * text field is on the right margin. If the text includes a line break(for
	 * example, <code>"\n"</code> or <code>"\r"</code>), the bottom is also
	 * resized to fit the next line of text. If <code>wordWrap</code> is also set
	 * to <code>true</code>, only the bottom of the text field is resized and the
	 * right side remains fixed.</p>
	 *
	 * <p>If <code>autoSize</code> is set to
	 * <code>TextFieldAutoSize.RIGHT</code>, the text is treated as
	 * right-justified text, meaning that the right margin of the text field
	 * remains fixed and any resizing of a single line of the text field is on
	 * the left margin. If the text includes a line break(for example,
	 * <code>"\n" or "\r")</code>, the bottom is also resized to fit the next
	 * line of text. If <code>wordWrap</code> is also set to <code>true</code>,
	 * only the bottom of the text field is resized and the left side remains
	 * fixed.</p>
	 *
	 * <p>If <code>autoSize</code> is set to
	 * <code>TextFieldAutoSize.CENTER</code>, the text is treated as
	 * center-justified text, meaning that any resizing of a single line of the
	 * text field is equally distributed to both the right and left margins. If
	 * the text includes a line break(for example, <code>"\n"</code> or
	 * <code>"\r"</code>), the bottom is also resized to fit the next line of
	 * text. If <code>wordWrap</code> is also set to <code>true</code>, only the
	 * bottom of the text field is resized and the left and right sides remain
	 * fixed.</p>
	 *
	 * @throws ArgumentError The <code>autoSize</code> specified is not a member
	 *                       of flash.text.TextFieldAutoSize.
	 */
	private _autoSize: string;

	public get autoSize(): string {
		return this._autoSize;
	}

	public set autoSize(value: string) {
		if (this._autoSize == value)
			return;

		if (typeof value === 'string') {
			if (value != TextFieldAutoSize.CENTER &&
                 value != TextFieldAutoSize.NONE &&
                 value != TextFieldAutoSize.LEFT &&
                 value != TextFieldAutoSize.RIGHT) {
				return;
			}
		} else {
			if (typeof value === 'boolean') {
				if (value)
					value = TextFieldAutoSize.LEFT;
				else
					value = TextFieldAutoSize.NONE;
			}
			if (typeof value === 'number') {
				if (value > 0)
					value = TextFieldAutoSize.LEFT;
				else
					value = TextFieldAutoSize.NONE;
			}
		}

		this._autoSize = value;

		this._positionsDirty = true;

		if (this._autoSize != TextFieldAutoSize.NONE)
			this.invalidate();
	}

	private _internalScale: Vector3D = new Vector3D(1,1,1);
	public get internalScale(): Vector3D {
		return this._internalScale;
	}
	// public getInternalScale(view:View = null):Vector3D
	// {
	// 	if(this.parent)
	// 		this._internalScale.copyFrom(this.parent.transform.concatenatedMatrix3D.decompose()[3]);
	// 	else
	// 		this._internalScale.identity();

	// 	if (view) {
	// 		this._internalScale.x *= view.focalLength*view.pixelRatio/1000;
	// 		this._internalScale.y *= view.focalLength/1000;
	// 	}

	//     this._internalScale.x=1/this._internalScale.x;
	//     this._internalScale.y=1/this._internalScale.y;
	// 	return this._internalScale;
	// }
	public _iInternalUpdate(): void {
		super._iInternalUpdate();

		//if (!this.inMaskMode) {

		this.reConstruct(true);

		/*if (this._textFormat
			&& !this._textFormat.font_table.isAsset(TesselatedFontTable)
			&& !this._textFormat.material) {
			// only for FNT font-tables
			// todo: do we still need this ?

			this.transform.colorTransform || (this.transform.colorTransform = new ColorTransform());
			this.transform.colorTransform.color = (this.textColor != null) ? this.textColor : this._textFormat.color;
			this._invalidateHierarchicalProperties(HierarchicalProperties.COLOR_TRANSFORM);
		}*/
		//}
		/*
		if (projection) {
			this._strokeScale.x = (<PerspectiveProjection> projection).hFocalLength/1000;
			this._strokeScale.y = (<PerspectiveProjection> projection).focalLength/1000;
		}else{
			this._strokeScale.x = 1;
			this._strokeScale.y = 1;
		}
        this._graphics.updateScale(projection);*/

		//const prevScaleX: number = this._internalScale.x;
		//const prevScaleY: number = this._internalScale.y;
		// var scale:Vector3D = this.getInternalScale(view);
		// if (scale.x == prevScaleX && scale.y == prevScaleY)
		//      return;
		// this._internalScale=scale;
		// this._glyphsDirty=true;

	}

	/**
	 * //TODO
	 *
	 * @private
	 */
	private _onGraphicsInvalidate(event: AssetEvent): void {
		const isEntity: boolean = this.isEntity();

		if (this._isEntity != isEntity) {
			if (!isEntity)
				this._clearEntity();

			this._isEntity = isEntity;
		}

		this.invalidate();
	}

	/**
	 *
	 * @returns {string}
	 */
	public get assetType(): string {
		return TextField.assetType;
	}

	/**
	 * Specifies whether the text field has a background fill. If
	 * <code>true</code>, the text field has a background fill. If
	 * <code>false</code>, the text field has no background fill. Use the
	 * <code>backgroundColor</code> property to set the background color of a
	 * text field.
	 *
	 * @default false
	 */
	private _background: boolean;
	public get background(): boolean {
		return this._background;
	}

	public set background(value: boolean) {
		if (this._background == value)
			return;
		this._background = value;
		this._shapesDirty = true;
	}

	/**
	 * The color of the text field background. The default value is
	 * <code>0xFFFFFF</code>(white). This property can be retrieved or set, even
	 * if there currently is no background, but the color is visible only if the
	 * text field has the <code>background</code> property set to
	 * <code>true</code>.
	 */
	private _backgroundColor: number /*int*/;
	public get backgroundColor(): number {
		return this._backgroundColor;
	}

	public set backgroundColor(value: number) {
		this._backgroundColor = value;
		this._shapesDirty = true;
	}

	/**
	 * Specifies whether the text field has a border. If <code>true</code>, the
	 * text field has a border. If <code>false</code>, the text field has no
	 * border. Use the <code>borderColor</code> property to set the border color.
	 *
	 * @default false
	 */
	private _border: boolean;
	public get border(): boolean {
		return this._border;
	}

	public set border(value: boolean) {
		if (value == this._border)
			return;
		this._border = value;
		this._shapesDirty = true;
	}

	/**
	 * The color of the text field border. The default value is
	 * <code>0x000000</code>(black). This property can be retrieved or set, even
	 * if there currently is no border, but the color is visible only if the text
	 * field has the <code>border</code> property set to <code>true</code>.
	 */
	private _borderColor: number /*int*/;
	public get borderColor(): number {
		return this._borderColor;
	}

	public set borderColor(value: number) {
		if (value == this.borderColor)
			return;
		this._borderColor = value;
		this._shapesDirty = true;
	}

	/**
	 * An integer(1-based index) that indicates the bottommost line that is
	 * currently visible in the specified text field. Think of the text field as
	 * a window onto a block of text. The <code>scrollV</code> property is the
	 * 1-based index of the topmost visible line in the window.
	 *
	 * <p>All the text between the lines indicated by <code>scrollV</code> and
	 * <code>bottomScrollV</code> is currently visible in the text field.</p>
	 */
	public get bottomScrollV(): number /*int*/ {
		return this._bottomScrollV;
	}

	public set bottomScrollV(value: number) /*int*/ {
		if (value == this._bottomScrollV)
			return;
		this._bottomScrollV = value;
	}

	/**
	 * The index of the insertion point(caret) position. If no insertion point
	 * is displayed, the value is the position the insertion point would be if
	 * you restored focus to the field(typically where the insertion point last
	 * was, or 0 if the field has not had focus).
	 *
	 * <p>Selection span indexes are zero-based(for example, the first position
	 * is 0, the second position is 1, and so on).</p>
	 */
	public get caretIndex(): number /*int*/ {
		return this._caretIndex;
	}

	/**
	 * A Boolean value that specifies whether extra white space(spaces, line
	 * breaks, and so on) in a text field with HTML text is removed. The default
	 * value is <code>false</code>. The <code>condenseWhite</code> property only
	 * affects text set with the <code>htmlText</code> property, not the
	 * <code>text</code> property. If you set text with the <code>text</code>
	 * property, <code>condenseWhite</code> is ignored.
	 *
	 * <p>If <code>condenseWhite</code> is set to <code>true</code>, use standard
	 * HTML commands such as <code><BR></code> and <code><P></code> to place line
	 * breaks in the text field.</p>
	 *
	 * <p>Set the <code>condenseWhite</code> property before setting the
	 * <code>htmlText</code> property.</p>
	 */
	public condenseWhite: boolean;

	/**
	 * Specifies the format applied to newly inserted text, such as text entered
	 * by a user or text inserted with the <code>replaceSelectedText()</code>
	 * method.
	 *
	 * <p><b>Note:</b> When selecting characters to be replaced with
	 * <code>setSelection()</code> and <code>replaceSelectedText()</code>, the
	 * <code>defaultTextFormat</code> will be applied only if the text has been
	 * selected up to and including the last character. Here is an example:</p>
	 * <pre xml:space="preserve"> public my_txt:TextField new TextField();
	 * my_txt.text = "Flash Macintosh version"; public my_fmt:TextFormat = new
	 * TextFormat(); my_fmt.color = 0xFF0000; my_txt.defaultTextFormat = my_fmt;
	 * my_txt.setSelection(6,15); // partial text selected - defaultTextFormat
	 * not applied my_txt.setSelection(6,23); // text selected to end -
	 * defaultTextFormat applied my_txt.replaceSelectedText("Windows version");
	 * </pre>
	 *
	 * <p>When you access the <code>defaultTextFormat</code> property, the
	 * returned TextFormat object has all of its properties defined. No property
	 * is <code>null</code>.</p>
	 *
	 * <p><b>Note:</b> You can't set this property if a style sheet is applied to
	 * the text field.</p>
	 *
	 * @throws Error This method cannot be used on a text field with a style
	 *               sheet.
	 */

	// CODE BELOW IS NOT IN USE! Instead of defaultTextFormat away only use textFormat.
	// Take a look into get/set defaultTextFormat in playerglobal/lib/text/TextField.ts

	// public _defaultTextFormat: TextFormat;

	// public get defaultTextFormat(): TextFormat {
	// }

	// public set defaultTextFormat(value: TextFormat) {
	// }

	/**
	 * Specifies whether the text field is a password text field. If the value of
	 * this property is <code>true</code>, the text field is treated as a
	 * password text field and hides the input characters using asterisks instead
	 * of the actual characters. If <code>false</code>, the text field is not
	 * treated as a password text field. When password mode is enabled, the Cut
	 * and Copy commands and their corresponding keyboard shortcuts will not
	 * function. This security mechanism prevents an unscrupulous user from using
	 * the shortcuts to discover a password on an unattended computer.
	 *
	 * @default false
	 */
	public displayAsPassword: boolean;

	/**
	 * Specifies whether to render by using embedded font outlines. If
	 * <code>false</code>, Flash Player renders the text field by using device
	 * fonts.
	 *
	 * <p>If you set the <code>embedFonts</code> property to <code>true</code>
	 * for a text field, you must specify a font for that text by using the
	 * <code>font</code> property of a TextFormat object applied to the text
	 * field. If the specified font is not embedded in the SWF file, the text is
	 * not displayed.</p>
	 *
	 * @default false
	 */
	public embedFonts: boolean;

	/**
	 * The type of grid fitting used for this text field. This property applies
	 * only if the <code>flash.text.AntiAliasType</code> property of the text
	 * field is set to <code>flash.text.AntiAliasType.ADVANCED</code>.
	 *
	 * <p>The type of grid fitting used determines whether Flash Player forces
	 * strong horizontal and vertical lines to fit to a pixel or subpixel grid,
	 * or not at all.</p>
	 *
	 * <p>For the <code>flash.text.GridFitType</code> property, you can use the
	 * following string values:</p>
	 *
	 * @default pixel
	 */
	public gridFitType: GridFitType;

	/**
	 *
	 */
	public get height(): number {
		if (this._autoSize != TextFieldAutoSize.NONE)
			this.reConstruct();

		return this._height;
	}

	public set height(val: number) {
		if (this._height == val)
			return;

		if (this._autoSize != TextFieldAutoSize.NONE)
			return;

		this._height = val;

		this._positionsDirty = true;

		this.invalidate();
	}

	/**
	 * Contains the HTML representation of the text field contents.
	 *
	 * <p>Flash Player supports the following HTML tags:</p>
	 *
	 * <p>Flash Player and AIR also support explicit character codes, such as
	 * &#38;(ASCII ampersand) and &#x20AC;(Unicode € symbol). </p>
	 */
	private _htmlText: string;
	public get htmlText(): string {
		return this._htmlText;
	}

	public set htmlText(value: string) {

		if (value == this._htmlText)
			return;

		this._htmlText = value;
		const processedText = HTMLTextProcessor.get().processHTML(this, value);

		// 	text might be the same,
		//	we still need to set textDirty, because formatting might have changed
		//console.log("html out",  textProps.text);
		this._labelData = null;
		this._text = processedText;
		this._iText = processedText;
		this._iTextWoLineBreaks = processedText.replace(/(\r\n|\n|\\n|\r)/gm,'');
		this._textDirty = true;
		//console.log("set text", value, "on" , this);
		if (this._autoSize != TextFieldAutoSize.NONE)
			this.invalidate();
		else
			this._invalidateEntity();

		this.newTextFormat = this._textFormats[this._textFormats.length - 1];

	}

	/**
	 * The number of characters in a text field. A character such as tab
	 * (<code>\t</code>) counts as one character.
	 */
	public get length(): number /*int*/	{
		return this._iText.length;
	}

	/**
	 * The maximum number of characters that the text field can contain, as
	 * entered by a user. A script can insert more text than
	 * <code>maxChars</code> allows; the <code>maxChars</code> property indicates
	 * only how much text a user can enter. If the value of this property is
	 * <code>0</code>, a user can enter an unlimited amount of text.
	 *
	 * @default 0
	 */
	public maxChars: number /*int*/;

	/**
	 * The maximum value of <code>scrollH</code>.
	 */
	public get maxScrollH(): number /*int*/	{
		this.reConstruct();
		return this._maxScrollH;
	}

	/**
	 * The maximum value of <code>scrollV</code>.
	 */
	public get maxScrollV(): number /*int*/	{
		this.reConstruct();
		return this._maxScrollV;
	}

	/**
	 * A Boolean value that indicates whether Flash Player automatically scrolls
	 * multiline text fields when the user clicks a text field and rolls the
	 * mouse wheel. By default, this value is <code>true</code>. This property is
	 * useful if you want to prevent mouse wheel scrolling of text fields, or
	 * implement your own text field scrolling.
	 */
	public mouseWheelEnabled: boolean;

	/**
	 * Indicates whether field is a multiline text field. If the value is
	 * <code>true</code>, the text field is multiline; if the value is
	 * <code>false</code>, the text field is a single-line text field. In a field
	 * of type <code>TextFieldType.INPUT</code>, the <code>multiline</code> value
	 * determines whether the <code>Enter</code> key creates a new line(a value
	 * of <code>false</code>, and the <code>Enter</code> key is ignored). If you
	 * paste text into a <code>TextField</code> with a <code>multiline</code>
	 * value of <code>false</code>, newlines are stripped out of the text.
	 *
	 * @default false
	 */
	public multiline: boolean;

	/**
	 * Defines the number of text lines in a multiline text field. If
	 * <code>wordWrap</code> property is set to <code>true</code>, the number of
	 * lines increases when text wraps.
	 */
	public get numLines(): number /*int*/ {
		this.reConstruct();
		return this._numLines;
	}

	/**
	 * Indicates the set of characters that a user can enter into the text field.
	 * If the value of the <code>restrict</code> property is <code>null</code>,
	 * you can enter any character. If the value of the <code>restrict</code>
	 * property is an empty string, you cannot enter any character. If the value
	 * of the <code>restrict</code> property is a string of characters, you can
	 * enter only characters in the string into the text field. The string is
	 * scanned from left to right. You can specify a range by using the hyphen
	 * (-) character. Only user interaction is restricted; a script can put any
	 * text into the text field. <ph outputclass="flashonly">This property does
	 * not synchronize with the Embed font options in the Property inspector.
	 *
	 * <p>If the string begins with a caret(^) character, all characters are
	 * initially accepted and succeeding characters in the string are excluded
	 * from the set of accepted characters. If the string does not begin with a
	 * caret(^) character, no characters are initially accepted and succeeding
	 * characters in the string are included in the set of accepted
	 * characters.</p>
	 *
	 * <p>The following example allows only uppercase characters, spaces, and
	 * numbers to be entered into a text field:</p>
	 * <pre xml:space="preserve"> my_txt.restrict = "A-Z 0-9"; </pre>
	 *
	 * <p>The following example includes all characters, but excludes lowercase
	 * letters:</p>
	 * <pre xml:space="preserve"> my_txt.restrict = "^a-z"; </pre>
	 *
	 * <p>You can use a backslash to enter a ^ or - verbatim. The accepted
	 * backslash sequences are \-, \^ or \\. The backslash must be an actual
	 * character in the string, so when specified in ActionScript, a double
	 * backslash must be used. For example, the following code includes only the
	 * dash(-) and caret(^):</p>
	 * <pre xml:space="preserve"> my_txt.restrict = "\\-\\^"; </pre>
	 *
	 * <p>The ^ can be used anywhere in the string to toggle between including
	 * characters and excluding characters. The following code includes only
	 * uppercase letters, but excludes the uppercase letter Q:</p>
	 * <pre xml:space="preserve"> my_txt.restrict = "A-Z^Q"; </pre>
	 *
	 * <p>You can use the <code>\u</code> escape sequence to construct
	 * <code>restrict</code> strings. The following code includes only the
	 * characters from ASCII 32(space) to ASCII 126(tilde).</p>
	 * <pre xml:space="preserve"> my_txt.restrict = "\u0020-\u007E"; </pre>
	 *
	 * @default null
	 */
	public _restrict: string;
	public _restrictRegex: RegExp;
	public get restrict(): string {
		return this._restrict;
	}

	public set restrict(value: string) {
		if (value == this._restrict)
			return;
		this._restrict = value;
		this._restrictRegex = null;
		if (typeof value == 'undefined')
			return;
		value = value.toString();

		// flash allows something like -9 to be used instaed 0-9. fix this here:
		if (value.length >= 2 && value[0] == '-' && !isNaN(parseInt(value[1])))
			value = '0' + value;

		// remove all backslashes. flash does not allow to use backslash as allowed char
		value = value.replace(/\\/g, '');
		// remove all ^. flash does not allow to use ^ as allowed char
		value = value.replace(/\^/g, '');

		// make sure all "-" are escaped if they are not used to define a range
		// eslint-disable-next-line no-useless-escape
		value = value.replace(/([^a-zA-Z0-9])\-/g, '$1\\-');

		// escape all special chars so that regex will be valid
		//todo: should be able to do the following with a single regex:
		value = value.replace(/\./g, '\\.');
		// eslint-disable-next-line no-useless-escape
		value = value.replace(/\</g, '\\<');
		// eslint-disable-next-line no-useless-escape
		value = value.replace(/\>/g, '\\>');
		value = value.replace(/\+/g, '\\+');
		value = value.replace(/\*/g, '\\*');
		value = value.replace(/\?/g, '\\?');
		value = value.replace(/\[/g, '\\[');
		value = value.replace(/\]/g, '\\]');
		value = value.replace(/\$/g, '\\$');
		value = value.replace(/\(/g, '\\(');
		value = value.replace(/\)/g, '\\)');
		value = value.replace(/\{/g, '\\{');
		value = value.replace(/\}/g, '\\}');
		// eslint-disable-next-line no-useless-escape
		value = value.replace(/\=/g, '\\=');
		// eslint-disable-next-line no-useless-escape
		value = value.replace(/\!/g, '\\!');
		// eslint-disable-next-line no-useless-escape
		value = value.replace(/\:/g, '\\:');
		value = value.replace(/\|/g, '\\|');
		value = value.replace(/\//g, '\\/');
		// eslint-disable-next-line no-useless-escape
		value = value.replace(/\%/g, '\\%');

		this._restrictRegex = new RegExp('[^' + value + ']', 'g');

	}

	/**
	 * The current horizontal scrolling position. If the <code>scrollH</code>
	 * property is 0, the text is not horizontally scrolled. This property value
	 * is an integer that represents the horizontal position in pixels.
	 *
	 * <p>The units of horizontal scrolling are pixels, whereas the units of
	 * vertical scrolling are lines. Horizontal scrolling is measured in pixels
	 * because most fonts you typically use are proportionally spaced; that is,
	 * the characters can have different widths. Flash Player performs vertical
	 * scrolling by line because users usually want to see a complete line of
	 * text rather than a partial line. Even if a line uses multiple fonts, the
	 * height of the line adjusts to fit the largest font in use.</p>
	 *
	 * <p><b>Note: </b>The <code>scrollH</code> property is zero-based, not
	 * 1-based like the <code>scrollV</code> vertical scrolling property.</p>
	 */
	private _scrollH: number;

	public get scrollH(): number /*int*/ {
		return this._scrollH;
	}

	public set scrollH(value: number) /*int*/ {
		if (value == this._scrollH)
			return;
		this._scrollH = value;
	}

	/**
	 * The vertical position of text in a text field. The <code>scrollV</code>
	 * property is useful for directing users to a specific paragraph in a long
	 * passage, or creating scrolling text fields.
	 *
	 * <p>The units of vertical scrolling are lines, whereas the units of
	 * horizontal scrolling are pixels. If the first line displayed is the first
	 * line in the text field, scrollV is set to 1(not 0). Horizontal scrolling
	 * is measured in pixels because most fonts are proportionally spaced; that
	 * is, the characters can have different widths. Flash performs vertical
	 * scrolling by line because users usually want to see a complete line of
	 * text rather than a partial line. Even if there are multiple fonts on a
	 * line, the height of the line adjusts to fit the largest font in use.</p>
	 */
	public _scrollV: number;

	public get scrollV(): number /*int*/ {
		return this._scrollV;
	}

	public set scrollV(value: number) /*int*/ {
		const rounded = Math.round(value);

		if (rounded === this._scrollV)
			return;

		this._scrollV = rounded;

		if (this._scrollV > this._maxScrollV)
			this._scrollV = this._maxScrollV;

		if (this._scrollV <= 0) {
			this._scrollV = 0;
		}

		if (!this.textChild) {
			return;
		}

		// unsafe
		this.textChild.y = -this.lines_start_y[this._scrollV];
	}

	/**
	 * A Boolean value that indicates whether the text field is selectable. The
	 * value <code>true</code> indicates that the text is selectable. The
	 * <code>selectable</code> property controls whether a text field is
	 * selectable, not whether a text field is editable. A dynamic text field can
	 * be selectable even if it is not editable. If a dynamic text field is not
	 * selectable, the user cannot select its text.
	 *
	 * <p>If <code>selectable</code> is set to <code>false</code>, the text in
	 * the text field does not respond to selection commands from the mouse or
	 * keyboard, and the text cannot be copied with the Copy command. If
	 * <code>selectable</code> is set to <code>true</code>, the text in the text
	 * field can be selected with the mouse or keyboard, and the text can be
	 * copied with the Copy command. You can select text this way even if the
	 * text field is a dynamic text field instead of an input text field. </p>
	 *
	 * @default true
	 */
	private _selectable: boolean;
	public get selectable(): boolean	{
		return this._selectable;
	}

	public set selectable(value: boolean) {
		if (this.selectable == value) {
			return;
		}

		this._selectable = value;
		this.mouseEnabled = value;
		this.cursorType = value ? 'text' : '';

		if (value) {
			this.addEventListener(MouseEvent.DRAG_START, this.startSelectionByMouseDelegate);
			this.addEventListener(MouseEvent.DRAG_STOP, this.stopSelectionByMouseDelegate);
			this.addEventListener(MouseEvent.DRAG_MOVE, this.updateSelectionByMouseDelegate);
		} else {
			this.removeEventListener(MouseEvent.DRAG_START, this.startSelectionByMouseDelegate);
			this.removeEventListener(MouseEvent.DRAG_STOP, this.stopSelectionByMouseDelegate);
			this.removeEventListener(MouseEvent.DRAG_MOVE, this.updateSelectionByMouseDelegate);
		}
	}

	/**
	 * The zero-based character index value of the first character in the current
	 * selection. For example, the first character is 0, the second character is
	 * 1, and so on. If no text is selected, this property is the value of
	 * <code>caretIndex</code>.
	 */
	public get selectionBeginIndex(): number /*int*/ {
		return this._selectionBeginIndex;
	}

	/**
	 * The zero-based character index value of the last character in the current
	 * selection. For example, the first character is 0, the second character is
	 * 1, and so on. If no text is selected, this property is the value of
	 * <code>caretIndex</code>.
	 */
	public get selectionEndIndex(): number /*int*/ {
		return this._selectionEndIndex;
	}

	/**
	 * The sharpness of the glyph edges in this text field. This property applies
	 * only if the <code>flash.text.AntiAliasType</code> property of the text
	 * field is set to <code>flash.text.AntiAliasType.ADVANCED</code>. The range
	 * for <code>sharpness</code> is a number from -400 to 400. If you attempt to
	 * set <code>sharpness</code> to a value outside that range, Flash sets the
	 * property to the nearest value in the range(either -400 or 400).
	 *
	 * @default 0
	 */
	public sharpness: number;

	/**
	 * Attaches a style sheet to the text field. For information on creating
	 * style sheets, see the StyleSheet class and the <i>ActionScript 3.0
	 * Developer's Guide</i>.
	 *
	 * <p>You can change the style sheet associated with a text field at any
	 * time. If you change the style sheet in use, the text field is redrawn with
	 * the new style sheet. You can set the style sheet to <code>null</code> or
	 * <code>undefined</code> to remove the style sheet. If the style sheet in
	 * use is removed, the text field is redrawn without a style sheet. </p>
	 *
	 * <p><b>Note:</b> If the style sheet is removed, the contents of both
	 * <code>TextField.text</code> and <code> TextField.htmlText</code> change to
	 * incorporate the formatting previously applied by the style sheet. To
	 * preserve the original <code>TextField.htmlText</code> contents without the
	 * formatting, save the value in a variable before removing the style
	 * sheet.</p>
	 */
	public styleSheet: StyleSheet;

	/**
	 * A string that is the current text in the text field. Lines are separated
	 * by the carriage return character(<code>'\r'</code>, ASCII 13). This
	 * property contains unformatted text in the text field, without HTML tags.
	 *
	 * <p>To get the text in HTML form, use the <code>htmlText</code>
	 * property.</p>
	 */
	public get text(): string {
		return this._text;
	}

	public set text(value: string) {
		value = (typeof value === 'undefined') ? '' : value.toString();

		value = value.replace(String.fromCharCode(160), ' ');

		if (this._text == value)
			return;

		this._labelData = null;
		this._text = value;

		if (value != '' && ((value.charCodeAt(value.length - 1) == 13) || (value.charCodeAt(value.length - 1) == 10))) {
			value = value.slice(0, value.length - 1);
		}
		if (value != '' && (value.length >= 3
			&& value[value.length - 1] == 'n' && value[value.length - 2] == '\\' && value[value.length - 3] == '\\')) {
			value = value.slice(0, value.length - 3);
		}
		if (value != '' && (value.length >= 3 && value[value.length - 1] == 'n' && value[value.length - 2] == '\\')) {
			value = value.slice(0, value.length - 2);
		}

		for (const m of MNEMOS) {
			value = value.replace(m.test, m.replace);
		}

		this._iText = value;
		this._iTextWoLineBreaks = value.replace(/(\r\n|\n|\\n|\r)/gm,'');
		this._textFormats = [this.newTextFormat];
		this._textFormatsIdx = [this._iText.length];
		this._textDirty = true;

		//console.log("set text", value, "on" , this);
		if (this._autoSize != TextFieldAutoSize.NONE)
			this.invalidate();
		else
			this._invalidateEntity();

	}

	public setLabelData(labelData: any) {
		this._labelData = labelData;
		this.isStatic = true;
		this._iText = '';
		this._iTextWoLineBreaks = '';

		this._textDirty = false;
		this._positionsDirty = false;
		this._glyphsDirty = true;

		if (this._autoSize != TextFieldAutoSize.NONE)
			this.invalidate();
		else
			this._invalidateEntity();

	}

	public get newTextFormat(): TextFormat {
		// only use the newTextformat if it is available, otherwise fall back to textFormat
		return this._newTextFormat ? this._newTextFormat : this._textFormat ? this._textFormat : new TextFormat();
	}

	public set newTextFormat(value: TextFormat) {
		if (value) {
			this._newTextFormat = value.applyToFormat(this._textFormat.clone());
			return;
		}
		this._newTextFormat = null;
	}

	public get textFormat(): TextFormat {
		if (this._textFormat == null) {
			this._textFormat = new TextFormat();
		}
		return this._textFormat;
	}

	public set textFormat(value: TextFormat) {
		if (!value) throw new Error('TextField::: set textFormat - no value!');

		if (this._textFormat == value) {
			return;
		}
		this._textDirty = true;

		this._textFormat = value;
		this._textShapesDirty = true;
		// this._positionsDirty = true;
		// this._glyphsDirty = true;
		// this._shapesDirty = true;
		this._textDirty = true;
		//this.reConstruct();

		if (this._autoSize != TextFieldAutoSize.NONE)
			this.invalidate();
		else
			this._invalidateEntity();
	}

	/**
	 *
	 * @param renderer
	 *
	 * @internal
	 */
	public _acceptTraverser(traverser: IEntityTraverser): void {
		if (!this.maskMode) {
			//if(!this.cursorBlinking &&  this._isInFocus && this.cursorShape && this._type==TextFieldType.INPUT){
			//	traverser[this.cursorShape.elements.traverseName](this.cursorShape);
			//}
			this._graphics._acceptTraverser(traverser);
			//if(this.showSelection && this._isInFocus && this.bgShapeSelect){
			//	traverser[this.bgShapeSelect.elements.traverseName](this.bgShapeSelect);
			//}
			//if(this.bgShape){// && this.background){
			//	traverser[this.bgShape.elements.traverseName](this.bgShape);
			//}
		}
	}

	/**
	 * Indicates the horizontal scale(percentage) of the object as applied from
	 * the registration point. The default registration point is(0,0). 1.0
	 * equals 100% scale.
	 *
	 * <p>Scaling the local coordinate system changes the <code>x</code> and
	 * <code>y</code> property values, which are defined in whole pixels. </p>
	 */
	public get scaleX(): number {
		return this._transform.scale.x;
	}

	public set scaleX(val: number) {
		if (this._transform.scale.x == val) {
			return;
		}
		this._setScaleX(val);
	}

	/**
	 * Indicates the vertical scale(percentage) of an object as applied from the
	 * registration point of the object. The default registration point is(0,0).
	 * 1.0 is 100% scale.
	 *
	 * <p>Scaling the local coordinate system changes the <code>x</code> and
	 * <code>y</code> property values, which are defined in whole pixels. </p>
	 */
	public get scaleY(): number {
		return this._transform.scale.y;
	}

	public set scaleY(val: number) {
		if (this._transform.scale.y == val) {
			return;
		}
		this._setScaleY(val);
	}

	/**
	 * The color of the text in a text field, in hexadecimal format. The
	 * hexadecimal color system uses six digits to represent color values. Each
	 * digit has 16 possible values or characters. The characters range from 0-9
	 * and then A-F. For example, black is <code>0x000000</code>; white is
	 * <code>0xFFFFFF</code>.
	 *
	 * @default 0(0x000000)
	 */
	public _textColor: number /*int*/;

	public get textColor(): number {
		return this._textColor;
	}

	public set textColor(value: number) {
		if (this._textColor == value) {
			return;
		}
		this._textColor = value;
		//this._textFormat.color=value;
		if (this._textFormats) {
			let i = this._textFormats.length;
			while (i > 0) {
				i--;
				if (this._textFormats[i])
					this._textFormats[i].color = value;
			}
			this._textDirty = true;
		}

		/*if (this._textFormat
			&& !this._textFormat.font_table.isAsset(TesselatedFontTable)
			&& !this._textFormat.material) {

			if (!this.transform.colorTransform)
				this.transform.colorTransform = new ColorTransform();

			this.transform.colorTransform.color = value;
			this._invalidateHierarchicalProperties(HierarchicalProperties.COLOR_TRANSFORM);
		} else {
			this._glyphsDirty = true;

			if (this._implicitPartition)
				this._implicitPartition.invalidateEntity(this);
		//}*/

		this._glyphsDirty = true;

		this._invalidateEntity();
	}

	private getTextColorForTextFormat(format: TextFormat) {
		if (format.hasPropertySet('color')) {
			return format.color;
		}
		return this._textColor;
	}

	/**
	 * The interaction mode property, Default value is
	 * TextInteractionMode.NORMAL. On mobile platforms, the normal mode implies
	 * that the text can be scrolled but not selected. One can switch to the
	 * selectable mode through the in-built context menu on the text field. On
	 * Desktop, the normal mode implies that the text is in scrollable as well as
	 * selection mode.
	 */
	public get textInteractionMode(): TextInteractionMode {
		return this._textInteractionMode;
	}

	/**
	 * The width of the text in pixels.
	 */
	public get textWidth(): number {
		this.reConstruct();

		return this._textWidth;
	}

	/**
	 * The width of the text in pixels.
	 */
	public get textHeight(): number {
		this.reConstruct();
		if (this.type == TextFieldType.INPUT && this._iText == '') {
			this.textFormat.font_table.initFontSize(this.textFormat.size);
			return this.textFormat.font_table.getLineHeight();
		}

		return this._textHeight;
	}

	/**
	 * The thickness of the glyph edges in this text field. This property applies
	 * only when <code>AntiAliasType</code> is set to
	 * <code>AntiAliasType.ADVANCED</code>.
	 *
	 * <p>The range for <code>thickness</code> is a number from -200 to 200. If
	 * you attempt to set <code>thickness</code> to a value outside that range,
	 * the property is set to the nearest value in the range(either -200 or
	 * 200).</p>
	 *
	 * @default 0
	 */
	public thickness: number;

	/**
	 * The type of the text field. Either one of the following TextFieldType
	 * constants: <code>TextFieldType.DYNAMIC</code>, which specifies a dynamic
	 * text field, which a user cannot edit, or <code>TextFieldType.INPUT</code>,
	 * which specifies an input text field, which a user can edit.
	 *
	 * @default dynamic
	 * @throws ArgumentError The <code>type</code> specified is not a member of
	 *                       flash.text.TextFieldType.
	 */
	public _type: TextFieldType;

	public get type(): TextFieldType {
		return this._type;
	}

	public set type(value: TextFieldType) {
		if (this._type == value) {
			return;
		}
		this._type = value;
		this._textDirty = true;

		this._invalidateEntity();

		if (value == TextFieldType.INPUT) {
			//this._selectable=true;
			this.enableInput(true);
			this.addEventListener(KeyboardEvent.KEYDOWN, this.onKeyDelegate);
		} else {
			this.enableInput(false);
			this.removeEventListener(KeyboardEvent.KEYDOWN, this.onKeyDelegate);
		}
	}

	/**
	 * Specifies whether to copy and paste the text formatting along with the
	 * text. When set to <code>true</code>, Flash Player copies and pastes
	 * formatting(such as alignment, bold, and italics) when you copy and paste
	 * between text fields. Both the origin and destination text fields for the
	 * copy and paste procedure must have <code>useRichTextClipboard</code> set
	 * to <code>true</code>. The default value is <code>false</code>.
	 */
	public useRichTextClipboard: boolean;

	/**
	 * A Boolean value that indicates whether the text field has word wrap. If
	 * the value of <code>wordWrap</code> is <code>true</code>, the text field
	 * has word wrap; if the value is <code>false</code>, the text field does not
	 * have word wrap. The default value is <code>false</code>.
	 */
	public _wordWrap: boolean;

	public get x(): number {

		if (this._autoSize != TextFieldAutoSize.NONE && !this._wordWrap) {
			this.reConstruct();
		}

		return this._transform.position.x;
	}

	public set x(val: number) {
		if (this._autoSize != TextFieldAutoSize.NONE && !this._wordWrap)
			this.reConstruct();

		if (this._transform.position.x == val)
			return;

		this._transform.matrix3D._rawData[12] = val;

		this._transform.invalidatePosition();
	}

	/**
	 *
	 */
	public get width(): number {
		if (this._autoSize != TextFieldAutoSize.NONE && !this._wordWrap) {

			this.reConstruct();
		}

		return this._width;
	}

	public set width(val: number) {
		if (this._width == val)
			return;

		//if (this._autoSize != TextFieldAutoSize.NONE && !this._wordWrap)
		//	return;

		this._width = val;

		this._positionsDirty = true;

		this.invalidate();
	}

	public set wordWrap(val: boolean) {
		if (this._wordWrap == val)
			return;

		this._wordWrap = val;

		this._positionsDirty = true;

		if (!val)
			this.invalidate();
	}

	/**
	 * The width of the text in pixels.
	 */
	public get wordWrap(): boolean {
		return this._wordWrap;
	}

	/**
	 * Creates a new TextField instance. After you create the TextField instance,
	 * call the <code>addChild()</code> or <code>addChildAt()</code> method of
	 * the parent DisplayObjectContainer object to add the TextField instance to
	 * the display list.
	 *
	 * <p>The default size for a text field is 100 x 100 pixels.</p>
	 */
	constructor() {
		super();
		this.onKeyDelegate = (event: any) => this.onKey(event);
		this.startSelectionByMouseDelegate = (event: any) => this.startSelectionByMouse(event);
		this.stopSelectionByMouseDelegate = (event: any) => this.stopSelectionByMouse(event);
		this.updateSelectionByMouseDelegate = (event: any) => this.updateSelectionByMouse(event);

		this._onGraphicsInvalidateDelegate = (event: AssetEvent) => this._onGraphicsInvalidate(event);
		this._onClipboardPasteDelegate = (event: ClipboardEvent) => this.onClipboardPaste(event);

		this.cursorIntervalID = -1;

		this._tabEnabled = true;
		this.cursorType = '';
		this.textOffsetX = 0;
		this.textOffsetY = 0;
		this.textShapes = {};
		this._textColor = 0;
		this._width = 100;
		this._height = 100;
		this._textWidth = 0;
		this._textHeight = 0;
		this._type = TextFieldType.DYNAMIC;
		this._selectable = false;
		this._numLines = 0;
		this.multiline = false;
		this._autoSize = TextFieldAutoSize.NONE;
		this._wordWrap = false;
		this._background = false;
		this._backgroundColor = 0xffffff;
		this._border = false;
		this._borderColor = 0x000000;
		this.html = false;
		this.maxChars = 0;
		this._selectionBeginIndex = 0;
		this._selectionEndIndex = 0;
		this._scrollH = 0;
		this._scrollV = 0;
		this._textFormats = [];

		this._graphics = Graphics.getGraphics(); //unique graphics object for each TextField
		this._graphics.addEventListener(AssetEvent.INVALIDATE, this._onGraphicsInvalidateDelegate);

		this.mouseEnabled = this._selectable;
	}

	public advanceFrame(): void {
		//override for textfield
	}

	public isEntity(): boolean {
		return true;
	}

	public clear(): void {
		super.clear();
	}

	/**
	 * @inheritDoc
	 */
	public dispose(): void {
		this.disposeValues();

		TextField._textFields.push(this);
	}

	/**
	 * @inheritDoc
	 */
	public disposeValues(): void {
		super.disposeValues();

		if (this.maskChild) {
			this.maskChild.dispose();
			this.maskChild = null;
		}

		if (this.textChild) {
			this.textChild.dispose();
			this.textChild = null;
		}

		if (this.cursorShape) {
			this.cursorShape.dispose();
			this.cursorShape = null;
		}

		if (this.bgShapeSelect) {
			this.bgShapeSelect.dispose();
			this.bgShapeSelect = null;
		}

		if (this._labelData) {
			this._labelData = null;
		}

		this._resetParagraph();
		this._clearTextShapes();

		this._textFormat = null;
	}

	/**
	 * Reconstructs the Graphics for this Text-field.
	 */
	public reConstruct(buildGraphics: boolean = false) {

		if (!this._textDirty && !this._positionsDirty && !this._glyphsDirty && !this._shapesDirty)
			return;

		// Step1: init text-data

		// this step splits the text into textRuns and sort them into paragraphs
		// each textRun spans a range of words that share the same text-format
		// a textRun can not be shared between paragraphs

		// for each word, 5 numbers are stored:
		// 		char-index,
		// 		x-pos,
		// 		y-pos,
		// 		word-width,
		// 		char-count,
		// a whitespace is considered as a word

		if (this._textDirty) {
			this._positionsDirty = true;
			this._lastWordsCount = this.words.length;
			this.char_positions_x.length = 0;
			this.char_positions_y.length = 0;
			this.words.length = 0;
			this.lines_wordStartIndices.length = 0;
			this.lines_wordEndIndices.length = 0;
			this.lines_start_y.length = 0;
			this.lines_start_x.length = 0;
			this.lines_charIdx_start.length = 0;
			this.lines_charIdx_end.length = 0;
			this.lines_width.length = 0;
			this.lines_height.length = 0;
			this.lines_numSpacesPerline.length = 0;

			this._maxScrollH = 0;
			this._maxScrollV = 0;
			this._maxWidthLine = 0;

			// sometimes needed for TLFTextfields
			// todo: cleanup usage of _textFormats vs _textFormats
			if (!this._textFormat && this._textFormats.length > 0)
				this._textFormat = this._textFormats[0];

			this.buildParagraphs();

			//console.log("TextField buildParagraph", this.id, this._iText);
			//console.log("TextField buildParagraph", this.id, this._autoSize);
			//console.log("TextField buildParagraph", this.id, this._wordWrap);
			//console.log("TextField buildParagraph", this.id, this.multiline);

		}

		// 	Step 2: positioning the words

		// 	if position is dirty, the text formatting has changed.
		// 	this step will modify the word-data stored in previous step.
		//	for each word, it adjusts the x-pos and y-pos position.

		//	this step also takes care of adjusting the textWidth and textHeight,
		//	if we have AUTOSIZE!=None

		if (this._positionsDirty) {
			this._glyphsDirty = true;
			if (this._iText != '' && this._textFormat != null) {
				//console.log("TextField getWordPositions", this.id, this.words);
				this.getWordPositions();
			} else {
				// this is empty text, we need to reset the text-size
				this._textWidth = 0;
				this._textHeight = 0;
				if (this._autoSize != TextFieldAutoSize.NONE) {
					if (!this.wordWrap)
						this.adjustPositionForAutoSize(0);//(this._width - 4)/2);

					this._height = 4;
					if (this._type == TextFieldType.INPUT) {
						this.newTextFormat.font_table.initFontSize(this.newTextFormat.size);
						this._height = this.newTextFormat.font_table.getLineHeight() + 4;
					}
				}
				if (this._type == TextFieldType.INPUT)
					this.drawSelectionGraphics();
			}
			this.updateMaskMode();
		}

		this._textDirty = false;
		this._positionsDirty = false;
		if (!buildGraphics)
			return;

		// 	Step 3: building the glyphs

		// 	this step is only done if this function was called when renderer collects the graphics.
		//	only than should the reconstruct function be called with "buildGraphics=true".

		// 	in this step, the text-shapes are cleared,
		//	the data for new text-shapes is collected from the font-tables
		//	and the new text-shapes are created and assigned to the graphics

		if (this._glyphsDirty) {
			//console.log("TextField buildGlyphs", this.id, this.words);
			if (this._labelData) {
				this.buildGlyphsForLabelData();
			} else {
				this.buildGlyphs();
			}
		}

		this._glyphsDirty = false;

		if (this._labelData) {
			return;
		}

		this.buildShapes();
		this._shapesDirty = false;

	}

	public reset() {
		super.reset();
		//if(this.name && typeof this.name !== "number"){
		// if the textfield has a valid name, it might have been changed by scripts.
		// in that case we want to reset it to its original state
		if (this.sourceTextField) {
			this.sourceTextField.copyTo(this);

		}
		//}
		/*if(this.adapter != this){
			(<any>this.adapter).syncTextFieldValue();
		}*/

	}

	private onClipboardPaste(event: ClipboardEvent) {
		const paste = (event.clipboardData || (<any>self).clipboardData).getData('text');

		if (!paste) {
			return;
		}

		event.preventDefault();

		if (this._selectionBeginIndex > 0 || this._selectionEndIndex > this.length) {
			this._insertNewText(paste);
			return;
		}

		this.text = paste;
	}

	private _resetParagraph() {
		this._textShapesDirty = this._textShapesDirty || this.chars_codes.length > 0;

		this.tf_per_char.length = 0;
		this.chars_width.length = 0;
		this.chars_codes.length = 0;
		this._paragraph_textRuns_indices.length = 0;
		this._textRuns_formats.length = 0;
		this._textRuns_words.length = 0;
	}

	private buildParagraphs() {
		if (!this._textDirty) {
			return;
		}

		// clear paragraph data when clear
		if (this._iText === '' || !this._textFormat) {
			this._resetParagraph();
			return;
		}

		let paragraphIndex = 0;
		let formatIndex = 0;
		let wordIndex = 0;
		let charCodeIndex = 0;

		// track char mutations between new and older.
		let codeChanges = 0;
		let linewidth = 0;
		let c_start = 0;

		const thisText = this._iText;
		const formatsCount = this._textFormatsIdx.length;
		const paragraphIndices = this._paragraph_textRuns_indices;
		const textRunFormats = this._textRuns_formats;
		const textRunWords = this._textRuns_words;
		const charCodes = this.chars_codes;
		const charTextFormats = this.tf_per_char;
		const charWidths = this.chars_width;

		const pushParagraph = (formatIndex: number) => {
			paragraphIndices[paragraphIndex] = formatIndex;
			paragraphIndex++;
		};

		const pushFormat = (format: TextFormat, updateParagraph = false) => {
			updateParagraph && pushParagraph(formatIndex);
			textRunFormats[formatIndex++] = format;
			return format;
		};

		const pushRunEntry = (word: IRunEntry) => {
			textRunWords[wordIndex++] = word;
			return word;
		};

		const pushCharData = (code: number, tf: TextFormat, width: number) => {
			codeChanges += +(code !== charCodes[charCodeIndex]);
			codeChanges += +(tf !== charTextFormats[charCodeIndex]);
			codeChanges += +(width !== charWidths[charCodeIndex]);

			charCodes[charCodeIndex] = code;
			charTextFormats[charCodeIndex] = tf;
			charWidths[charCodeIndex] = width;

			charCodeIndex++;
		};

		pushParagraph(formatIndex);

		// loop over all textFormats
		for (let f = 0; f < formatsCount; f++) {
			let word_cnt = 0;
			let whitespace_cnt = 0;
			let startNewWord = true;
			const tf = this._textFormats[f];

			const maxLineWidth = this._width - (tf.indent + tf.leftMargin + tf.rightMargin);

			tf.font_table.initFontSize(tf.size);
			// if that is last format then it goes till the end of text:
			const c_end = (f === formatsCount - 1) ? thisText.length : this._textFormatsIdx[f];

			if (c_end > c_start) {

				// create a new textrun
				pushFormat(tf);

				let run = pushRunEntry({
					start: this.words.length,
					count: 0,
					width: 0,
					space: 0
				});

				// loop over all chars for this format
				//console.log("textrun tf = ", tf);
				for (let c = c_start; c < c_end; c++) {
					let char_code = thisText.charCodeAt(c);

					let next_char_code = thisText.charCodeAt(c + 1);
					// skip CR, because there are only 2 variation
					// CRLF or LF
					if (char_code === CHAR_CODES.CR) {
						char_code = CHAR_CODES.LF;
					}

					// again skip CR
					if (char_code === CHAR_CODES.BS && next_char_code === CHAR_CODES.R) {
						c += 1;
						continue;
					}

					// \n to LF
					if (char_code === CHAR_CODES.BS && next_char_code === CHAR_CODES.N) {
						c += 1;
						char_code = CHAR_CODES.LF;
						next_char_code = thisText.charCodeAt(c + 1);
					}

					const isLineBreak = char_code === CHAR_CODES.LF;

					if (isLineBreak) {
						run.count = word_cnt;
						run.width = linewidth;
						run.space = whitespace_cnt;

						// create a new textrun
						pushFormat(tf, true);

						run = pushRunEntry({
							start: this.words.length,
							count: 0,
							width: 0,
							space: 0
						});

						startNewWord = true;
						whitespace_cnt = 0;
						word_cnt = 0;

						if (this._maxWidthLine < linewidth) {
							this._maxWidthLine = linewidth;
						}
						linewidth = 0;
						continue;
					}

					let char_width = tf.font_table.getCharWidth(char_code.toString());

					const isSpace = char_code == CHAR_CODES.TAB || char_code == CHAR_CODES.SPACE;

					// if this is a letter, and next char is no whitespace, we add the letterSpacing to the letter-width
					// todo: we might need to add the letterspacing also if next char is a linebreak ?
					if (!isSpace && c < c_end - 1) {
						if (next_char_code != CHAR_CODES.TAB && next_char_code != CHAR_CODES.SPACE) {
							char_width += tf.letterSpacing;
						}
					}

					linewidth += char_width;

					pushCharData(char_code, tf, char_width);

					// we create a new word if the char is either:
					// 	- first char of paragraph
					//	- is a whitespace
					//  - follows a whitespace
					if (isSpace) {
						//console.log("add WhiteSpace");
						whitespace_cnt++;
						this.words.put(
							charCodeIndex - 1,
							0, 0,
							char_width,
							1
						);
						word_cnt++;
						// we also make sure to begin a new word for next char (could be whitespace again)
						startNewWord = true;
					} else {
						// no whitespace

						if (word_cnt > 0 && this._autoSize == TextFieldAutoSize.NONE && this._wordWrap) {
							if (this.words.last.width + char_width >= maxLineWidth) {
								startNewWord = true;
							}
						}

						if (startNewWord) {
							//console.log("startNewWord");
							// create new word (either this is the first char, or the last char was whitespace)
							this.words.put(
								charCodeIndex - 1,
								0, 0,
								char_width,
								1
							);

							word_cnt++;
						} else {
							// update-char length and width of active word.
							this.words.last.width += char_width;
							this.words.last.len += 1;
						}

						startNewWord = false;
					}
				}

				run.count = word_cnt;
				run.width = linewidth;
				run.space = whitespace_cnt;

				if (this._maxWidthLine < linewidth) {
					this._maxWidthLine = linewidth;
				}
			}

			c_start = c_end;
		}

		this._textShapesDirty = (
			this._textShapesDirty ||
			codeChanges > 0 ||
			charCodes.length !== charCodeIndex
		);

		// reduce paragraph count if will be greater that older
		paragraphIndices.length = paragraphIndex;
		textRunWords.length = wordIndex;
		textRunFormats.length = formatIndex;
		charCodes.length = charCodeIndex;
		charTextFormats.length = charCodeIndex;
		charWidths.length = charCodeIndex;
	}

	private adjustPositionForAutoSize(newWidth: number) {

		const oldSize: number = this._width;
		this._width = 4 + newWidth;

		if (this._autoSize == TextFieldAutoSize.RIGHT) {
			this._transform.matrix3D._rawData[12] -= this._width - oldSize;
			this._transform.invalidatePosition();
		} else if (this._autoSize == TextFieldAutoSize.CENTER) {
			this._transform.matrix3D._rawData[12] -= (this._width - oldSize) / 2;
			this._transform.invalidatePosition();
		}
	}

	private getWordPositions() {
		/*console.log("this._iText", this._iText);
		console.log("this._width", this._width);
		console.log("this._height", this._height);*/
		/*for(var i=0; i<this.chars_codes.length; i++){
            console.log("test: ", this.chars_codes[i], this.chars_width[i]);
        }*/
		let tr: number = 0;
		let tr_len: number = this._textRuns_formats.length;

		let w: number = 0;
		let w_len: number = 0;
		let tr_length: number = 0;
		let format: TextFormat;
		let text_width: number = 0;
		let indent: number = 0;
		this._numLines = 0;
		let linecnt: number = 0;
		let linelength: number = 0;
		let word_width: number = 0;

		let offsety: number = this.textOffsetY + 2;

		//console.log("text old_width", this._width);
		//console.log("text old_x", this._transform.matrix3D._rawData[12]);
		//console.log("this._autoSize", this._autoSize);
		//console.log("this._wordWrap", this._wordWrap);

		// if we have autosize enabled, and no wordWrap, we can adjust the textfield width
		if (this._autoSize != TextFieldAutoSize.NONE && !this._wordWrap && this._textDirty) {
			const maxSizeComplete: number =
				this._maxWidthLine + this._textFormat.indent
				+ this._textFormat.leftMargin + this._textFormat.rightMargin;
			this.adjustPositionForAutoSize(maxSizeComplete);
		}

		const maxLineWidth: number =
			this._width - (this._textFormat.indent + this._textFormat.leftMargin + this._textFormat.rightMargin);

		let p: number = 0;
		const p_len: number = this._paragraph_textRuns_indices.length;
		linecnt = 0;
		this.lines_wordStartIndices.length = 0;
		this.lines_wordEndIndices.length = 0;
		this.lines_start_y.length = 0;
		this.lines_start_x.length = 0;
		this.lines_width.length = 0;
		this.lines_height.length = 0;
		this.lines_numSpacesPerline.length = 0;
		this.lines_charIdx_start.length = 0;

		this.lines_charIdx_end.length = 0;
		const lines_heights: number[] = [];
		const lines_formats: TextFormat[] = [];
		// loop over all paragraphs

		for (p = 0; p < p_len; p++) {
			tr_len = (p == (p_len - 1)) ? this._textRuns_formats.length : this._paragraph_textRuns_indices[p + 1];
			tr_length = 0;
			lines_heights[lines_heights.length] = 0;
			for (tr = this._paragraph_textRuns_indices[p]; tr < tr_len; tr++) {
				format = this._textRuns_formats[tr];
				format.font_table.initFontSize(format.size);
				if (lines_heights[lines_heights.length - 1] < (format.font_table.getLineHeight() + format.leading)) {
					lines_heights[lines_heights.length - 1] = format.font_table.getLineHeight() + format.leading;
				}

				//console.log("process word positions for textrun", tr, "textruns",  this._textRuns_words);
				w_len = this._textRuns_words[tr].start + this._textRuns_words[tr].count;
				tr_length += this._textRuns_words[tr].width;
				//console.log(this._textFieldWidth, tr_length, maxLineWidth);
			}

			this.lines_wordStartIndices[this.lines_wordStartIndices.length]
				= this._textRuns_words[this._paragraph_textRuns_indices[p]].start;
			this.lines_wordEndIndices[this.lines_wordEndIndices.length] = w_len;
			this.lines_width[this.lines_width.length] = 0;
			this.lines_numSpacesPerline[this.lines_numSpacesPerline.length] = 0;
			let lineHeightCnt: number = 0;
			this.lines_height[this.lines_height.length] = lines_heights[lineHeightCnt];
			lines_formats[linecnt] = format;

			for (tr = this._paragraph_textRuns_indices[p]; tr < tr_len; tr++) {
				format = this._textRuns_formats[tr];
				format.font_table.initFontSize(format.size);
				indent = format.indent;
				w_len = this._textRuns_words[tr].start + this._textRuns_words[tr].count;
				if (tr_length <= maxLineWidth || !this.wordWrap) {
					//if(tr_length<maxLineWidth || !this.wordWrap){
					// this must be a single textline
					//console.log("just add to line",(tr * 4) , w_len, this.words, this._textRuns_words);
					for (w = this._textRuns_words[tr].start; w < w_len; w += 1) {
						const word = this.words.get(w);

						word_width = word.width;
						linelength += word_width;

						this.lines_wordEndIndices[linecnt] = w + 1;
						this.lines_width[linecnt] += word_width;

						lines_formats[linecnt] = format;

						if (this.chars_codes[word.start] == 32 || this.chars_codes[word.start] == 9) {
							this.lines_numSpacesPerline[linecnt] += 1;
						}
					}
				} else {
					//console.log("split lines");
					word_width = 0;
					indent = 0;

					for (w = this._textRuns_words[tr].start; w < w_len; w += 1) {
						const word = this.words.get(w);

						word_width = word.width;

						let isSpace: boolean = false;

						if (this.chars_codes[word.start] == 32 || this.chars_codes[word.start] == 9) {
							this.lines_numSpacesPerline[linecnt] += 1;
							isSpace = true;
						}

						// (1.5* format.font_table.getCharWidth("32")) is to replicate flash behavior
						if (isSpace
							|| (this.lines_width[linecnt] + word_width) <= (
								maxLineWidth - indent - (1 * format.font_table.getCharWidth('32')))
							|| this.lines_width[linecnt] == 0) {
							this.lines_wordEndIndices[linecnt] = w + 1;
							this.lines_width[linecnt] += word_width;
							lines_formats[linecnt] = format;
						} else {
							linecnt++;
							this.lines_wordStartIndices[linecnt] = w;
							this.lines_wordEndIndices[linecnt] = w + 1;
							this.lines_width[linecnt] = word_width;
							this.lines_numSpacesPerline[linecnt] = 0;
							this.lines_height[this.lines_height.length] = lines_heights[lineHeightCnt];

							lines_formats[linecnt] = format;
							indent = format.indent;
						}
					}
					//console.log("split lines",linecnt );
				}
				//}
			}
			lineHeightCnt++;
			linecnt++;
		}
		let offsetx: number = this.textOffsetX;
		let start_idx: number;
		let numSpaces: number;
		let lineHeight: number;
		let end_idx: number;
		let lineSpaceLeft: number;
		let l: number;
		let c: number = 0;
		const l_cnt: number = this.lines_wordStartIndices.length;

		let charCnt: number = 0;
		this._biggestLine = 0;
		this._numLines = l_cnt;
		for (l = 0; l < l_cnt; l++) {
			linelength = this.lines_width[l];
			lineHeight = this.lines_height[l];
			start_idx = this.lines_wordStartIndices[l];
			end_idx = this.lines_wordEndIndices[l];
			numSpaces = this.lines_numSpacesPerline[l];
			format = lines_formats[l];
			//console.log("numLine:", l,linelength,start_idx,end_idx,numSpaces);

			lineSpaceLeft = maxLineWidth - linelength;

			/*console.log("lineSpaceLeft", lineSpaceLeft);
			console.log("maxLineWidth", maxLineWidth);
			console.log("linelength", linelength);*/
			offsetx = this.textOffsetX + format.leftMargin + format.indent;

			if (format.align == TextFormatAlign.JUSTIFY) {
				if ((l != l_cnt - 1) && lineSpaceLeft > 0 && numSpaces > 0) {
					// this is a textline that should be justified
				}
				if (l != 0) {
					// only first line has indent
					offsetx -= format.indent;
				}
			} else if (format.align == TextFormatAlign.CENTER) {
				if (lineSpaceLeft > 0)
					offsetx += lineSpaceLeft / 2;
				else {
					offsetx += 2;
				}
			} else if (format.align == TextFormatAlign.RIGHT) {
				if (lineSpaceLeft > 0)
					offsetx += lineSpaceLeft - 2;
				else {
					offsetx += 2;
				}
			} else if (format.align == TextFormatAlign.LEFT) {
				offsetx += 2;
			}

			let c_len: number = 0;
			let char_pos: number = offsetx;
			this.lines_start_x[l] = offsetx;
			this.lines_start_y[l] = offsety;
			this.lines_charIdx_start[l] = charCnt;
			let line_width = 0;//format.leftMargin + format.indent + format.rightMargin;

			for (w = start_idx; w < end_idx; w += 1) {
				const word = this.words.get(w);

				word.x = offsetx;
				char_pos = 0;
				start_idx = word.start;
				c_len = start_idx + word.len;

				const tf = this.tf_per_char[start_idx];
				tf.font_table.initFontSize(tf.size);
				//console.log("lineHeight", lineHeight);
				//console.log("lineHeight", tf.font_table.getLineHeight()+tf.leading);
				let diff = (lineHeight) - (tf.font_table.getLineHeight() + tf.leading);
				diff = ((diff > 0) ? diff - 2 : 0);
				word.y = offsety + diff;

				for (c = start_idx; c < c_len; c++) {
					this.char_positions_x[this.char_positions_x.length] = offsetx + char_pos;
					this.char_positions_y[this.char_positions_y.length] = offsety + diff;
					char_pos += this.chars_width[c];
					charCnt++;
				}

				//console.log("word_width", char_pos, "word:'"+wordstr+"'");
				offsetx += char_pos;//this.words[w + 3];
				line_width += char_pos;//this.words[w + 3];
			}

			this.lines_charIdx_end[l] = charCnt;
			//console.log("line_width",line_width);
			offsety += lineHeight;

			/* enable for icycle:
			if(format.leading==11 && format.font_name=="DayPosterBlack"){
				offsety+=1.5;
			}*/

			if (line_width > text_width) {
				this._biggestLine = l;
				text_width = line_width;
			}
		}

		this._textWidth = text_width;
		this._textHeight = offsety;

		// if autosize is enabled, we adjust the textFieldHeight
		if (this.autoSize != TextFieldAutoSize.NONE)
			this._height = this._textHeight + 4;

		if (this._textWidth > this._width) {

			// get the max-scroll horizontal value
			start_idx = this.lines_charIdx_start[this._biggestLine];
			c = this.lines_charIdx_end[this._biggestLine];
			let maxCnt = 0;
			while (c > start_idx) {
				c--;
				maxCnt += this.chars_width[c];
				if (maxCnt > this._width) {
					this._maxScrollH = c;
					break;
				}
			}
		}
		if (this._textHeight > this._height) {
			// get the max-scroll vertical value
			let l_len: number = this.lines_height.length;
			let maxCnt = 4;
			while (l_len > 0) {
				l_len--;
				maxCnt += this.lines_height[l_len];
				if (maxCnt > this._height) {
					this._maxScrollV = l_len + 1;
					break;
				}
			}

		}
		this.updateMaskMode();

	}

	public staticMatrix: any;
	private buildGlyphsForLabelData() {

		this._clearTextShapes();

		const formats: TextFormat[] = [];
		const glyphdata: number[][] = [];
		const advance: number[][] = [];
		const positions: number[] = [];
		let xpos = (this.staticMatrix.tx / 20);
		let ypos = (this.staticMatrix.ty / 20);
		let record: any;
		let lastMoveY = 0;

		for (let r = 0; r < this._labelData.records.length;r++) {
			formats[r] = new TextFormat();
			glyphdata[r] = [];
			advance[r] = [];
			record = this._labelData.records[r];
			if (record.font_table) {
				formats[r].font_table = record.font_table;
			} else if (r > 0) {
				formats[r].font_table = formats[r - 1].font_table;
			} else {
				console.log('error - no font for label');
			}
			if (record.fontHeight) {
				formats[r].size = record.fontHeight / 20;
			} else if (r > 0) {
				formats[r].size = formats[r - 1].size;
			}
			if (record.color) {
				//textProps.color =  this.rgbaToArgb((<any>myChild.attributes).color.nodeValue);
				formats[r].color = ColorUtils.f32_RGBA_To_f32_ARGB(record.color);
			} else if (r > 0) {
				formats[r].color = formats[r - 1].color;
			}
			//positions.push(this.textOffsetX+(record.moveX? record.moveX/20:0));
			//positions.push(this.textOffsetY+(record.moveY? record.moveY/20:0));
			//moveY=(record.moveY? record.moveY/20:0)-moveY;
			if (record.moveY != null) {
				ypos += (record.moveY / 20) - lastMoveY;
				lastMoveY = ypos;
			} else {
				//ypos+=this.staticMatrix.ty/20;
			}
			//ypos=this.textOffsetY+(record.moveY? record.moveY/20:0);
			if (record.moveX != null) {
				xpos = (this.staticMatrix.tx / 20) + (record.moveX / 20);
			}
			positions.push(xpos);
			positions.push(ypos);

			for (let e = 0; e < record.entries.length;e++) {
				glyphdata[r][e] = record.entries[e].glyphIndex;
				advance[r][e] = record.entries[e].advance / 20;
				xpos += advance[r][e];
			}
		}

		let textShape: TextShape;
		// process all textRuns
		let tr: number = 0;
		const tr_len: number = formats.length;
		let lineSize: Point;
		let text_width: number = 0;
		let text_height: number = 0;
		for (tr = 0; tr < tr_len; tr++) {
			formats[tr].font_table.initFontSize(formats[tr].size);
			lineSize = (<TesselatedFontTable>formats[tr].font_table).buildTextLineFromIndices(
				this, formats[tr], positions[tr * 2], positions[tr * 2 + 1], glyphdata[tr], advance[tr]);
			text_height += lineSize.y;
			text_width = (lineSize.x > text_width) ? lineSize.x : text_width;
		}

		this._textWidth = text_width;
		this._textHeight = text_height;
		//this._width=text_width+4;
		//this._height=text_height+4;

		this.targetGraphics = this._graphics;
		this.targetGraphics.clear();

		this.drawBG();

		if (this.border || (!this._background && this._type != TextFieldType.INPUT))
			this.drawBorder();

		/*
		this._graphics.clear();
		this._graphics.beginFill(0xff0000, 1);//this.background?1:0);
		this._graphics.drawRect(-1,-1,this._width, this._height);
		this._graphics.endFill();
		*/

		for (const key in this.textShapes) {
			textShape = this.textShapes[key];

			const attr = new Float2Attributes(textShape.length / 2);
			const buffer = new Float32Array(attr.attributesBuffer.buffer);

			let offset = 0;
			for (const chunk of textShape.verts) {
				buffer.set(chunk, offset);
				offset += chunk.length;
			}

			textShape.elements = new TriangleElements();
			textShape.elements.setPositions(attr);
			textShape.elements.invalidate();

			textShape.shape = <Shape> this.targetGraphics.addShape(Shape.getShape(textShape.elements));

			// has BUG for QWOP, temporarily enable it (default)
			textShape.shape.deepHitCheck = true;
			textShape.shape.usages++;

			const sampler: ImageSampler = new ImageSampler();
			textShape.shape.style = new Style();
			if (textShape.format.material && this._textColor == 0) {
				textShape.shape.material = this._textFormat.material;
				textShape.shape.style.addSamplerAt(sampler, textShape.shape.material.getTextureAt(0));
				(<MaterialBase> textShape.shape.material).animateUVs = true;
				textShape.shape.style.uvMatrix =
					new Matrix(0, 0, 0, 0, textShape.format.uv_values[0], textShape.format.uv_values[1]);
			} else {

				const color = this.getTextColorForTextFormat(textShape.format);
				let alpha = ColorUtils.float32ColorToARGB(color)[0];
				if (alpha == 0) {
					alpha = 255;
				}
				const obj = MaterialManager.get_material_for_color(color, alpha / 255);

				textShape.shape.material = obj.material;
				if (obj.colorPos) {
					textShape.shape.style.addSamplerAt(sampler, textShape.shape.material.getTextureAt(0));
					(<MaterialBase> textShape.shape.material).animateUVs = true;
					textShape.shape.style.uvMatrix = new Matrix(0, 0, 0, 0, obj.colorPos.x, obj.colorPos.y);
				}
			}
		}
	}

	private buildGlyphs(): void {

		const tr_formats = this._textRuns_formats;
		const tr_words = this._textRuns_words;
		const tr_len = tr_formats.length;

		if (this._textShapesDirty) this._clearTextShapes();

		for (let tr = 0; tr < tr_len; tr++) {
			const run = tr_words[tr];

			if (run.count == 0) {
				continue;
			// } else if (tr_words[(tr * 4)] + tr_words[(tr * 4) + 1] * 5 <= this._words_amount_prev) {
				// continue;
			}

			tr_formats[tr].font_table.initFontSize(tr_formats[tr].size);

			if (Settings.USE_UNSAFE_FNT) {
				(tr_formats[tr].font_table as TesselatedFontTable).generateFNTData(null);
			}

			tr_formats[tr].font_table.fillTextRun(
				this, tr_formats[tr], run.start, run.count);
		}

		let textShape: TextShape;

		for (const key in this.textShapes) {
			textShape = this.textShapes[key];

			if (textShape.length === 0) {
				continue;
			}

			const attr = new Float2Attributes(textShape.length / 2);
			const pos = new Float32Array(attr.attributesBuffer.buffer);

			const uvAttr = textShape.hasUV ? new Float2Attributes(textShape.length / 2) : null;
			const uvs = uvAttr ? new Float32Array(uvAttr.attributesBuffer.buffer) : null;

			//console.log('Build shape size:', textShape.length);

			let offset = 0;
			for (let i = 0; i < textShape.verts.length; i++) {
				const chunk = textShape.verts[i];

				pos.set(chunk, offset);

				if (uvs) {
					uvs.set(textShape.uvs[i], offset);
				}

				offset += chunk.length;
			}

			// hack, merge buffer in single
			// this helps to avoid a lot of set in incremental filling
			// but anyway is slow
			textShape.length = 0;
			textShape.addChunk(pos, uvs);

			if (textShape.shape) {
				const element = <TriangleElements> textShape.shape.elements;
				// there are bug with attribute buffer, when add attr to exist
				element.setPositions(pos);

				if (uvs) {
					element.setUVs(uvs);
				}

				element.invalidate();

				attr.dispose();

				if (uvAttr) {
					uvAttr.dispose();
				}
				continue;
			}

			const color = this.getTextColorForTextFormat(textShape.format);
			const alpha = ColorUtils.float32ColorToARGB(color)[0] || 255;

			textShape.elements = new TriangleElements();

			textShape.elements.setPositions(attr);

			if (uvAttr) {
				textShape.elements.setUVs(uvAttr);
			}

			textShape.elements.invalidate();

			textShape.shape = Shape.getShape(textShape.elements);
			// has BUG for QWOP, temporarily enable it (default)
			textShape.shape.deepHitCheck = true;
			textShape.shape.usages++;

			const sampler: ImageSampler = new ImageSampler(false, true, true);
			textShape.shape.style = new Style();

			if (textShape.fntMaterial) {
				// 	used by FNT fonts
				textShape.shape.material = textShape.fntMaterial;
				textShape.shape.style.addSamplerAt(sampler, textShape.shape.material.getTextureAt(0));
				//(<MaterialBase> textShape.shape.material).colorTransform=new ColorTransform();
				//(<MaterialBase> textShape.shape.material).colorTransform.color=color;
			} else if (textShape.format.material && this._textColor == 0) {
				// 	used for textfields loaded from awd.
				//	the material on the format uses textureAtlas from awd
				textShape.shape.material = this._textFormat.material;
				textShape.shape.style.addSamplerAt(sampler, textShape.shape.material.getTextureAt(0));
				(<MaterialBase> textShape.shape.material).animateUVs = true;
				textShape.shape.style.uvMatrix =
					new Matrix(0, 0, 0, 0, textShape.format.uv_values[0], textShape.format.uv_values[1]);
			} else {
				// 	used by runtime textureatlas.
				//	(standart for dynamic created text and text loaded from swf)
				const obj = MaterialManager.get_material_for_color(color, alpha / 255);
				textShape.shape.material = obj.material;
				if (obj.colorPos) {
					textShape.shape.style.addSamplerAt(sampler, textShape.shape.material.getTextureAt(0));
					(<MaterialBase> textShape.shape.material).animateUVs = true;
					textShape.shape.style.uvMatrix = new Matrix(0, 0, 0, 0, obj.colorPos.x, obj.colorPos.y);
				}
			}
		}
	}

	private buildShapes() {
		if (!this.targetGraphics) {
			this.targetGraphics = this._graphics;
		} else {
			this._graphics.clear();
		}
		this.targetGraphics.clear();

		this.drawBG();

		if (this._border || !this._background) {
			this.drawBorder();
		}

		this.drawSelectionGraphics();

		if (this.bgShapeSelect && this.isInFocus && this.showSelection) {
			this.targetGraphics.addShape(this.bgShapeSelect);
		}

		let textShape: TextShape;

		for (const key in this.textShapes) {
			textShape = this.textShapes[key];

			if (!textShape.shape) {
				continue;
			}

            <Shape> this.targetGraphics.addShape(textShape.shape);
		}

		if (this.type === TextFieldType.INPUT && this.isInFocus && this.cursorShape && !this.cursorBlinking) {
			this.targetGraphics.addShape(this.cursorShape);
		}
	}

	/**
	 * Appends the string specified by the <code>newText</code> parameter to the
	 * end of the text of the text field. This method is more efficient than an
	 * addition assignment(<code>+=</code>) on a <code>text</code> property
	 * (such as <code>someTextField.text += moreText</code>), particularly for a
	 * text field that contains a significant amount of content.
	 *
	 * @param newText The string to append to the existing text.
	 */
	public appendText(newText: string) {
		// append zero lenght text
		if (!newText.length) {
			return;
		}

		this._iText += newText;
		this._textDirty = true;
		if (this._autoSize != TextFieldAutoSize.NONE)
			this.invalidate();
		else
			this._invalidateEntity();
	}

	/**
	 * *tells the Textfield that a paragraph is defined completly.
	 * e.g. the textfield will start a new line for future added text.
	 */
	public closeParagraph(): void {
		this._iText += '\n';
		this._textDirty = true;
		if (this._autoSize != TextFieldAutoSize.NONE)
			this.invalidate();
		else
			this._invalidateEntity();
	}

	/**
	 * Returns a rectangle that is the bounding box of the character.
	 *
	 * @param charIndex The zero-based index value for the character(for
	 *                  example, the first position is 0, the second position is
	 *                  1, and so on).
	 * @return A rectangle with <code>x</code> and <code>y</code> minimum and
	 *         maximum values defining the bounding box of the character.
	 */
	public getCharBoundaries(charIndex: number): Rectangle {

		const charBounds = new Rectangle();
		if (charIndex >= this.char_positions_x.length) {
			return charBounds;
		}
		charBounds.x = this.char_positions_x[charIndex];
		charBounds.width = this.chars_width[charIndex];
		charBounds.y = this.char_positions_y[charIndex];
		charBounds.height = 10; // @todo
		return charBounds;
	}

	/**
	 * Returns the zero-based index value of the character at the point specified
	 * by the <code>x</code> and <code>y</code> parameters.
	 *
	 * @param x The <i>x</i> coordinate of the character.
	 * @param y The <i>y</i> coordinate of the character.
	 * @return The zero-based index value of the character(for example, the
	 *         first position is 0, the second position is 1, and so on). Returns
	 *         -1 if the point is not over any character.
	 */
	public getCharIndexAtPoint(x: number, y: number, lineIdx: number = -1): number /*int*/ {
		if (lineIdx < 0) {
			lineIdx = this.getLineIndexAtPoint(x, y);
		}

		const startIdx = this.lines_charIdx_start[lineIdx];
		const endIdx = this.lines_charIdx_end[lineIdx];

		for (let i = startIdx; i < endIdx; i++) {
			if (x >= this.char_positions_x[i]) {
				if (x <= this.char_positions_x[i] + this.chars_width[i] / 2) {
					return i;
				} else if (x <= this.char_positions_x[i] + this.chars_width[i]) {
					return i + 1;
				}
			}
		}

		return -1;
	}

	/**
	 * Given a character index, returns the index of the first character in the
	 * same paragraph.
	 *
	 * @param charIndex The zero-based index value of the character(for example,
	 *                  the first character is 0, the second character is 1, and
	 *                  so on).
	 * @return The zero-based index value of the first character in the same
	 *         paragraph.
	 * @throws RangeError The character index specified is out of range.
	 */
	public getFirstCharInParagraph(charIndex: number /*int*/): number /*int*/ {
		console.log('Textfield.getFirstCharInParagraph() not implemented');
		return this._firstCharInParagraph;
	}

	/**
	 * Returns a DisplayObject reference for the given <code>id</code>, for an
	 * image or SWF file that has been added to an HTML-formatted text field by
	 * using an <code><img></code> tag. The <code><img></code> tag is in the
	 * following format:
	 *
	 * <p><pre xml:space="preserve"><code> <img src = 'filename.jpg' id =
	 * 'instanceName' ></code></pre></p>
	 *
	 * @param id The <code>id</code> to match(in the <code>id</code> attribute
	 *           of the <code><img></code> tag).
	 * @return The display object corresponding to the image or SWF file with the
	 *         matching <code>id</code> attribute in the <code><img></code> tag
	 *         of the text field. For media loaded from an external source, this
	 *         object is a Loader object, and, once loaded, the media object is a
	 *         child of that Loader object. For media embedded in the SWF file,
	 *         it is the loaded object. If no <code><img></code> tag with the
	 *         matching <code>id</code> exists, the method returns
	 *         <code>null</code>.
	 */
	public getImageReference(id: string): DisplayObject {
		console.log('TextField.getImageReference() not implemented');
		return this._imageReference;
	}

	/**
	 * Returns the zero-based index value of the line at the point specified by
	 * the <code>x</code> and <code>y</code> parameters.
	 *
	 * @param x The <i>x</i> coordinate of the line.
	 * @param y The <i>y</i> coordinate of the line.
	 * @return The zero-based index value of the line(for example, the first
	 *         line is 0, the second line is 1, and so on). Returns -1 if the
	 *         point is not over any line.
	 */
	public getLineIndexAtPoint(x: number, y: number): number /*int*/ {
		const len: number = this.lines_start_y.length;
		for (let i: number = 0;i < len - 1; i++) {
			if (y >= this.lines_start_y[i] && y <= this.lines_start_y[i + 1])
				return i;
		}
		// no line found. it must be the last
		if (y >= this.lines_start_y[len - 1])
			return len - 1;
		return 0;
	}

	/**
	 * Returns the zero-based index value of the line containing the character
	 * specified by the <code>charIndex</code> parameter.
	 *
	 * @param charIndex The zero-based index value of the character(for example,
	 *                  the first character is 0, the second character is 1, and
	 *                  so on).
	 * @return The zero-based index value of the line.
	 * @throws RangeError The character index specified is out of range.
	 */
	public getLineIndexOfChar(charIndex: number /*int*/): number /*int*/ {
		this.buildParagraphs();

		const len: number = this.lines_charIdx_start.length - 1;
		for (let i: number;i < len; i++) {
			if (charIndex >= this.lines_charIdx_start[i] && charIndex <= this.lines_charIdx_end[i + 1])
				return i;
		}
		// no line found. it must be the last
		return len;
	}

	/**
	 * Returns the number of characters in a specific text line.
	 *
	 * @param lineIndex The line number for which you want the length.
	 * @return The number of characters in the line.
	 * @throws RangeError The line number specified is out of range.
	 */
	public getLineLength(lineIndex: number /*int*/): number /*int*/ {
		if (this.lines_width.length == 0) {
			return 0;
		}
		if (lineIndex >= this.lines_width.length)
			return this.lines_width[this.lines_width.length - 1];
		return this.lines_width[lineIndex];
	}

	/**
	 * Returns metrics information about a given text line.
	 *
	 * @param lineIndex The line number for which you want metrics information.
	 * @return A TextLineMetrics object.
	 * @throws RangeError The line number specified is out of range.
	 */
	public getLineMetrics(lineIndex: number /*int*/): TextLineMetrics {
		const newLineMetrics = new TextLineMetrics();

		if (!this.lines_width.length) {
			return newLineMetrics;
		}

		// should throw error!
		if (lineIndex >= this.lines_width.length) {
			lineIndex = this.lines_width.length - 1;
		}

		newLineMetrics.x = this.lines_start_x[lineIndex];
		newLineMetrics.width = this.lines_width[lineIndex];
		newLineMetrics.height = this.lines_height[lineIndex];

		//newLineMetrics.ascent=
		//newLineMetrics.descent
		//newLineMetrics.height
		//newLineMetrics.leading
		return newLineMetrics;
	}

	/**
	 * Returns the character index of the first character in the line that the
	 * <code>lineIndex</code> parameter specifies.
	 *
	 * @param lineIndex The zero-based index value of the line(for example, the
	 *                  first line is 0, the second line is 1, and so on).
	 * @return The zero-based index value of the first character in the line.
	 * @throws RangeError The line number specified is out of range.
	 */
	public getLineOffset(lineIndex: number /*int*/): number /*int*/ {
		if (this.lines_charIdx_start.length == 0) {
			return 0;
		}
		if (lineIndex >= this.lines_charIdx_start.length)
			return this.lines_charIdx_start[this.lines_charIdx_start.length - 1];
		return this.lines_charIdx_start[lineIndex];
	}

	/**
	 * Returns the text of the line specified by the <code>lineIndex</code>
	 * parameter.
	 *
	 * @param lineIndex The zero-based index value of the line(for example, the
	 *                  first line is 0, the second line is 1, and so on).
	 * @return The text string contained in the specified line.
	 * @throws RangeError The line number specified is out of range.
	 */
	public getLineText(lineIndex: number /*int*/): string {
		if (this.lines_charIdx_start.length == 0) {
			return '';
		}
		if (lineIndex >= this.lines_width.length)
			lineIndex = this.lines_width.length - 1;

		return this._iText.slice(this.lines_charIdx_start[lineIndex], this.lines_charIdx_end[lineIndex]);
	}

	/**
	 * Given a character index, returns the length of the paragraph containing
	 * the given character. The length is relative to the first character in the
	 * paragraph(as returned by <code>getFirstCharInParagraph()</code>), not to
	 * the character index passed in.
	 *
	 * @param charIndex The zero-based index value of the character(for example,
	 *                  the first character is 0, the second character is 1, and
	 *                  so on).
	 * @return Returns the number of characters in the paragraph.
	 * @throws RangeError The character index specified is out of range.
	 */
	public getParagraphLength(charIndex: number /*int*/): number /*int*/ {
		return this._paragraphLength;
	}

	/**
	 * Returns a TextFormat object that contains formatting information for the
	 * range of text that the <code>beginIndex</code> and <code>endIndex</code>
	 * parameters specify. Only properties that are common to the entire text
	 * specified are set in the resulting TextFormat object. Any property that is
	 * <i>mixed</i>, meaning that it has different values at different points in
	 * the text, has a value of <code>null</code>.
	 *
	 * <p>If you do not specify values for these parameters, this method is
	 * applied to all the text in the text field. </p>
	 *
	 * <p>The following table describes three possible usages:</p>
	 *
	 * @return The TextFormat object that represents the formatting properties
	 *         for the specified text.
	 * @throws RangeError The <code>beginIndex</code> or <code>endIndex</code>
	 *                    specified is out of range.
	 */
	public getTextFormat(beginIndex: number /*int*/ = -1, endIndex: number /*int*/ = -1): TextFormat {
		if (!this.tf_per_char || !this.tf_per_char.length) {
			if (this._textFormat)
				return this._textFormat.clone();
			return new TextFormat();
		}
		if (beginIndex < 0)
			beginIndex = 0;
		if (endIndex > this.tf_per_char.length) {
			endIndex = this.tf_per_char.length;
		}
		const newTextFormat = this.tf_per_char[beginIndex].clone();
		let lastFormat = this.tf_per_char[beginIndex];
		for (let i = beginIndex + 1; i < endIndex; i++) {
			if (this.tf_per_char[i] == lastFormat) {
				continue;
			}
			newTextFormat.mergeFormat(this.tf_per_char[i]);
			lastFormat = this.tf_per_char[i];
		}
		return newTextFormat;
	}

	/**
	 * Replaces the current selection with the contents of the <code>value</code>
	 * parameter. The text is inserted at the position of the current selection,
	 * using the current default character format and default paragraph format.
	 * The text is not treated as HTML.
	 *
	 * <p>You can use the <code>replaceSelectedText()</code> method to insert and
	 * delete text without disrupting the character and paragraph formatting of
	 * the rest of the text.</p>
	 *
	 * <p><b>Note:</b> This method does not work if a style sheet is applied to
	 * the text field.</p>
	 *
	 * @param value The string to replace the currently selected text.
	 * @throws Error This method cannot be used on a text field with a style
	 *               sheet.
	 */
	public replaceSelectedText(value: string): void {

		return this._insertNewText(value);

		// this is wrong implemementation, how i see,
		// because it not right invalidate a text;

		/*
		let selectionStart: number = this._selectionBeginIndex;
		let selectionEnd: number = this._selectionEndIndex;
		if (selectionEnd != selectionStart) {
			if (selectionEnd < selectionStart) {
				selectionStart = this._selectionEndIndex;
				selectionEnd = this._selectionBeginIndex;
			}
			const textBeforeCursor: string = this._iText.slice(0, selectionStart - 1);
			const textAfterCursor: string = this._iText.slice(selectionEnd, this._iText.length);
			this.text = textBeforeCursor + value + textAfterCursor;
			this._selectionBeginIndex = selectionStart;
			this._selectionEndIndex = this._selectionBeginIndex + value.length;
			return;
		}
		const textBeforeCursor: string = this._iText.slice(0, selectionStart);
		const textAfterCursor: string = this._iText.slice(selectionEnd, this._iText.length);
		this.text = textBeforeCursor + value + textAfterCursor;
		this._selectionBeginIndex = selectionStart + 1;
		this._selectionEndIndex = this._selectionBeginIndex;
		*/
	}

	/**
	 * Replaces the range of characters that the <code>beginIndex</code> and
	 * <code>endIndex</code> parameters specify with the contents of the
	 * <code>newText</code> parameter. As designed, the text from
	 * <code>beginIndex</code> to <code>endIndex-1</code> is replaced.
	 *
	 * <p><b>Note:</b> This method does not work if a style sheet is applied to
	 * the text field.</p>
	 *
	 * @param beginIndex The zero-based index value for the start position of the
	 *                   replacement range.
	 * @param endIndex   The zero-based index position of the first character
	 *                   after the desired text span.
	 * @param newText    The text to use to replace the specified range of
	 *                   characters.
	 * @throws Error This method cannot be used on a text field with a style
	 *               sheet.
	 */
	public replaceText(beginIndex: number /*int*/, endIndex: number /*int*/, newText: string): void {

		const textBeforeCursor: string = this._iTextWoLineBreaks.slice(0, beginIndex - 1);
		const textAfterCursor: string = this._iTextWoLineBreaks.slice(endIndex, this._iTextWoLineBreaks.length);
		this.text = textBeforeCursor + newText + textAfterCursor;
		this._selectionEndIndex = this._selectionBeginIndex + newText.length;
	}

	/**
	 * Sets as selected the text designated by the index values of the first and
	 * last characters, which are specified with the <code>beginIndex</code> and
	 * <code>endIndex</code> parameters. If the two parameter values are the
	 * same, this method sets the insertion point, as if you set the
	 * <code>caretIndex</code> property.
	 *
	 * @param beginIndex The zero-based index value of the first character in the
	 *                   selection(for example, the first character is 0, the
	 *                   second character is 1, and so on).
	 * @param endIndex   The zero-based index value of the last character in the
	 *                   selection.
	 */
	public setSelection(beginIndex: number /*int*/, endIndex: number /*int*/): void {
		if (this._selectionBeginIndex == beginIndex && this._selectionBeginIndex == endIndex)
			return;
		this._selectionBeginIndex = beginIndex;
		this._selectionEndIndex = endIndex;
		this._glyphsDirty = true;
		this.reConstruct();
		this.drawSelectionGraphics();

	}

	/**
	 * Applies the text formatting that the <code>format</code> parameter
	 * specifies to the specified text in a text field. The value of
	 * <code>format</code> must be a TextFormat object that specifies the desired
	 * text formatting changes. Only the non-null properties of
	 * <code>format</code> are applied to the text field. Any property of
	 * <code>format</code> that is set to <code>null</code> is not applied. By
	 * default, all of the properties of a newly created TextFormat object are
	 * set to <code>null</code>.
	 *
	 * <p><b>Note:</b> This method does not work if a style sheet is applied to
	 * the text field.</p>
	 *
	 * <p>The <code>setTextFormat()</code> method changes the text formatting
	 * applied to a range of characters or to the entire body of text in a text
	 * field. To apply the properties of format to all text in the text field, do
	 * not specify values for <code>beginIndex</code> and <code>endIndex</code>.
	 * To apply the properties of the format to a range of text, specify values
	 * for the <code>beginIndex</code> and the <code>endIndex</code> parameters.
	 * You can use the <code>length</code> property to determine the index
	 * values.</p>
	 *
	 * <p>The two types of formatting information in a TextFormat object are
	 * character level formatting and paragraph level formatting. Each character
	 * in a text field can have its own character formatting settings, such as
	 * font name, font size, bold, and italic.</p>
	 *
	 * <p>For paragraphs, the first character of the paragraph is examined for
	 * the paragraph formatting settings for the entire paragraph. Examples of
	 * paragraph formatting settings are left margin, right margin, and
	 * indentation.</p>
	 *
	 * <p>Any text inserted manually by the user, or replaced by the
	 * <code>replaceSelectedText()</code> method, receives the default text field
	 * formatting for new text, and not the formatting specified for the text
	 * insertion point. To set the default formatting for new text, use
	 * <code>defaultTextFormat</code>.</p>
	 *
	 * @param format A TextFormat object that contains character and paragraph
	 *               formatting information.
	 * @throws Error      This method cannot be used on a text field with a style
	 *                    sheet.
	 * @throws RangeError The <code>beginIndex</code> or <code>endIndex</code>
	 *                    specified is out of range.
	 */
	public setTextFormat(format: TextFormat, beginIndex: number /*int*/ = -1, endIndex: number /*int*/ = -1): void {
		/**
         *  this should only effect existing text
         *  if no text exist, this function does nothing
         *
         *  this means that we only want to act on the existing textFormats list,
         *  never on the textFormat property directly
         * */
		if (!format || this._iTextWoLineBreaks.length == 0)
			return;

		if ((beginIndex == -1 && endIndex == -1)
            || (beginIndex == 0 && endIndex == -1)
			|| ((beginIndex == -1 || beginIndex == 0)
				&& endIndex >= this._iTextWoLineBreaks.length)) {

			const len = this._textFormats.length;

			if (this._textFormats.length === 1 && this._textFormats[0].equal(format)) {
				return;
			}

			// easy: apply the format to all formats in the list
			for (let i = 0; i < len; i++) {
				this._textFormats[i] = this._textFormats[i].clone();
				format.applyToFormat(this._textFormats[i]);
			}

			this._textDirty = true;
			this._textShapesDirty = true;

			return;
		}

		// todo: the above conditions are a hack to get it working for a AVM1 lesson.
		// below is the code that should actually do the job more, but could not get it to work 100% yet

		//console.log("\n\nadd format", this.id, this._iText, beginIndex, endIndex, format.color);
		//console.log("this._textFormats", this._textFormats, this._textFormatsIdx);

		let i = 0;

		/**
         * _textformatsIdx list should always be ordered numeric
         * todo: should this be verified here, or is it already taken care of ?
         */
		const newFormatsTextFormats: TextFormat[] = [];
		const newFormatsTextFormatsIdx: number[] = [];
		let oldStartIdx: number = 0;
		let oldEndIdx: number = -1;
		let oldFormat: TextFormat;
		const formatLen = this._textFormats.length;
		const textLen = this._iTextWoLineBreaks.length;

		if (beginIndex == -1) beginIndex = 0;
		if (endIndex == -1) endIndex = textLen;

		if (endIndex < beginIndex) {
			const tmp = endIndex;
			endIndex = beginIndex;
			beginIndex = tmp;
		}

		if (endIndex == beginIndex) endIndex++;

		//console.log("check formats");
		for (let i = 0; i < formatLen; i++) {
			if (i > 0) oldStartIdx = oldEndIdx;

			oldEndIdx = this._textFormatsIdx[i];
			oldFormat = this._textFormats[i];
			//console.log("oldFormat", oldStartIdx, oldEndIdx);

			//console.log("check formats", oldStartIdx, oldEndIdx, beginIndex, endIndex);
			if (oldStartIdx <= beginIndex && oldEndIdx > beginIndex) {
				// we have a interset in the range.
				//console.log("intersects");
				// we have a bit of text that should remain the original format
				if (oldStartIdx < beginIndex) {
					newFormatsTextFormats.push(oldFormat);
					newFormatsTextFormatsIdx.push(beginIndex);
					//console.log("add old format", beginIndex);
				}

				while (oldEndIdx < endIndex) {
					//console.log("add new merged format", oldEndIdx);
					const newFormat = this._textFormats[i].clone();
					format.applyToFormat(newFormat);
					newFormatsTextFormats.push(newFormat);
					newFormatsTextFormatsIdx.push(oldEndIdx);
					i++;
					if (i < formatLen) {
						oldEndIdx = this._textFormatsIdx[i];
						oldFormat = this._textFormats[i];
					} else {
						oldEndIdx = endIndex + 1;
					}
				}
				if (oldEndIdx == endIndex) {
					//console.log("add new format rest", endIndex);
					const newFormat = oldFormat.clone();
					format.applyToFormat(newFormat);
					newFormatsTextFormats.push(newFormat);
					newFormatsTextFormatsIdx.push(endIndex);
				}
				if (oldEndIdx > endIndex) {
					//console.log("add new format rest", endIndex);
					const newFormat = oldFormat.clone();
					format.applyToFormat(newFormat);
					newFormatsTextFormats.push(newFormat);
					newFormatsTextFormatsIdx.push(endIndex);
					//console.log("add old format rest", oldEndIdx);
					newFormatsTextFormats.push(oldFormat);
					newFormatsTextFormatsIdx.push(oldEndIdx);
				}
			} else {
				//console.log("outside of new range. just add it", oldStartIdx, oldEndIdx);
				// outside of new range. just add it
				newFormatsTextFormats.push(this._textFormats[i]);
				newFormatsTextFormatsIdx.push(this._textFormatsIdx[i]);

			}
		}

		//console.log("new formats");
		this._textFormats.length = 0;
		this._textFormatsIdx.length = 0;
		for (i = 0; i < newFormatsTextFormats.length;i++) {
			//console.log("new formats ", newFormatsTextFormatsIdx[i], newFormatsTextFormats[i]);
			this._textFormats[i] = newFormatsTextFormats[i];
			this._textFormatsIdx[i] = newFormatsTextFormatsIdx[i];
		}

		this._textDirty = true;
		this._textShapesDirty = true;
	}

	/**
	 * Returns true if an embedded font is available with the specified
	 * <code>fontName</code> and <code>fontStyle</code> where
	 * <code>Font.fontType</code> is <code>flash.text.FontType.EMBEDDED</code>.
	 * Starting with Flash Player 10, two kinds of embedded fonts can appear in a
	 * SWF file. Normal embedded fonts are only used with TextField objects. CFF
	 * embedded fonts are only used with the flash.text.engine classes. The two
	 * types are distinguished by the <code>fontType</code> property of the
	 * <code>Font</code> class, as returned by the <code>enumerateFonts()</code>
	 * function.
	 *
	 * <p>TextField cannot use a font of type <code>EMBEDDED_CFF</code>. If
	 * <code>embedFonts</code> is set to <code>true</code> and the only font
	 * available at run time with the specified name and style is of type
	 * <code>EMBEDDED_CFF</code>, Flash Player fails to render the text, as if no
	 * embedded font were available with the specified name and style.</p>
	 *
	 * <p>If both <code>EMBEDDED</code> and <code>EMBEDDED_CFF</code> fonts are
	 * available with the same name and style, the <code>EMBEDDED</code> font is
	 * selected and text renders with the <code>EMBEDDED</code> font.</p>
	 *
	 * @param fontName  The name of the embedded font to check.
	 * @param fontStyle Specifies the font style to check. Use
	 *                  <code>flash.text.FontStyle</code>
	 * @return <code>true</code> if a compatible embedded font is available,
	 *         otherwise <code>false</code>.
	 * @throws ArgumentError The <code>fontStyle</code> specified is not a member
	 *                       of <code>flash.text.FontStyle</code>.
	 */
	public static isFontCompatible(fontName: string, fontStyle: string): boolean {
		return false;
	}

	public onKeyDelegate: (e: any) => void;
	public onKey(e: any) {
		const keyEvent: KeyboardEvent = <KeyboardEvent>e;
		this.addChar(keyEvent.char, keyEvent.isShift, keyEvent.isCTRL, keyEvent.isAlt);

		//console.log("textfield.onKey this.text", this.text);
	}

	public addCharCode(charCode: number) {
		this.addChar(String.fromCharCode(charCode));

	}

	private deleteSelectedText(deleteMode: string = 'Backspace') {

		if (this.text.length == 0)
			return;

		if (this._selectionBeginIndex != this._selectionEndIndex) {
			const textBeforeCursor: string =
				(this._selectionBeginIndex != 0) ? this._iText.slice(0, this._selectionBeginIndex) : '';
			const textAfterCursor: string =
				(this._selectionEndIndex < this._iText.length) ?
					this._iText.slice(this._selectionEndIndex, this._iText.length) : '';
			this.text = textBeforeCursor + textAfterCursor;
			this._selectionEndIndex = this._selectionBeginIndex;
			return;
		}
		if (deleteMode == 'Backspace') {
			if (this._selectionBeginIndex == 0) {
				return;
			}
			const textBeforeCursor: string = this._iText.slice(0, this._selectionBeginIndex - 1);
			const textAfterCursor: string = this._iText.slice(this._selectionEndIndex, this._iText.length);
			this.text = textBeforeCursor + textAfterCursor;
			this._selectionBeginIndex -= 1;
			this._selectionEndIndex = this._selectionBeginIndex;
		} else if (deleteMode == 'Delete') {
			const textBeforeCursor: string = this._iText.slice(0, this._selectionBeginIndex);
			const textAfterCursor: string = this._iText.slice(this._selectionEndIndex + 1, this._iText.length);
			this.text = textBeforeCursor + textAfterCursor;
			this._selectionEndIndex = this._selectionBeginIndex;
		}

	}

	public addChar(char: string, isShift: boolean = false, isCTRL: boolean = false, isAlt: boolean = false) {

		let changed = false;
		const oldText = this._iText;

		if (!this._selectionBeginIndex) {
			this._selectionBeginIndex = 0;
		}

		if (!this._selectionEndIndex) {
			this._selectionEndIndex = 0;
		}

		if (this._selectionEndIndex < this._selectionBeginIndex) {
			const tmpStart: number = this._selectionEndIndex;
			this._selectionEndIndex = this._selectionBeginIndex;
			this._selectionBeginIndex = tmpStart;
		}

		if (!isAlt && !isCTRL) {
			if (char == 'Backspace' || char == 'Delete') {
				this.deleteSelectedText(char);
				changed = true;
			} else if (char == 'ArrowRight') {
				if (!isShift && this._selectionEndIndex != this._selectionBeginIndex) {
					if (this._selectionEndIndex > this._selectionBeginIndex) {
						this._selectionBeginIndex = this._selectionEndIndex;
					} else {
						this._selectionEndIndex = this._selectionBeginIndex;
					}
				} else {
					if (this._selectionEndIndex > this._selectionBeginIndex) {
						this._selectionEndIndex += 1;
						if (!isShift)
							this._selectionBeginIndex = this._selectionEndIndex;
					} else {
						this._selectionBeginIndex += 1;
						if (!isShift)
							this._selectionEndIndex = this._selectionBeginIndex;

					}
				}

				changed = true;
				//this._selectionEndIndex=this._selectionBeginIndex;
			} else if (char == 'ArrowLeft') {
				if (!isShift && this._selectionEndIndex != this._selectionBeginIndex) {
					if (this._selectionEndIndex > this._selectionBeginIndex)
						this._selectionEndIndex = this._selectionBeginIndex;
					else
						this._selectionBeginIndex = this._selectionEndIndex;
				} else {
					if (this._selectionEndIndex > this._selectionBeginIndex) {
						this._selectionBeginIndex -= 1;
						if (!isShift)
							this._selectionEndIndex = this._selectionBeginIndex;
					} else {
						this._selectionEndIndex -= 1;
						if (!isShift)
							this._selectionBeginIndex = this._selectionEndIndex;

					}
				}

				changed = true;
				//this._selectionEndIndex=this._selectionBeginIndex;
			} else if (char == 'Enter' && this.multiline) {
				this._insertNewText('\n');
				changed = true;
			} else if (char.length == 1) {
				if (this._restrictRegex) {
					const chartest1 = char.replace(this._restrictRegex, '');
					if (chartest1.length < char.length) {
						const chartest2 = char.toUpperCase().replace(this._restrictRegex, '');
						const chartest3 = char.toLowerCase().replace(this._restrictRegex, '');
						char = chartest2;
						if (chartest2.length < chartest3.length) {
							char = chartest3;
						}
						if (chartest1.length > char.length) {
							char = chartest1;
						}
					}
					if (char == '')
						return;
				}
				if (this.newTextFormat.font_table) {

					const table = this.newTextFormat.font_table;
					const symbol = char.charCodeAt(0).toString();
					let exist = false;

					exist = (exist || table.hasChar(symbol));
					exist = (exist || table.hasChar(symbol.toLowerCase()));
					exist = (exist || table.hasChar(symbol.toUpperCase()));

					if (!exist) {

						console.log('Char not found', symbol);
						return;
					}
				}

				this._insertNewText(char);
				changed = true;
			} else if (char.length > 1) {
				console.log('invalid keyboard input: ', char);
			}

			if (changed) {
				this._glyphsDirty = true;
				//this.reConstruct();
				//this.drawSelectionGraphics();
				this.invalidate();

				if (oldText !== this._iText) {
					this.dispatchEvent(TextField._onChangedEvent);
				}
			}
		} else {
			/**
			* @todo THIS IS SHIT!!! This won't working on MacOS, because it use another Ctrl + V/C
			* @see `enableInput` setter for right implementation
			*/
			if (isCTRL && !isShift && char === 'v') {
				// paste
				// try do it
				if (navigator.clipboard.readText) {
					navigator.clipboard.readText()
						.then(e => {
							this._insertNewText(e);
						})
						.catch((e)=>{
							console.warn('[TextField] Can\'t paste text:', e.message);
						});
				}
			}
		}

		if (char && char.length > 0 && this.adapter != this) {
			let charCode: number;
			switch (char) {
				case 'Backspace':
					charCode = 8;
					break;
				case 'Delete':
					charCode = 46;
					break;
				case 'ArrowRight':
					charCode = 39;
					break;
				case 'ArrowLeft':
					charCode = 37;
					break;
				case '.':
					charCode = 189;
					break;
				default:
					charCode = char.charCodeAt(0);
					break;
			}
			//console.log("dispatchKeyEvent");
			(<ITextfieldAdapter> this.adapter).dispatchKeyEvent(charCode, isShift, isCTRL, isAlt);
		}
	}

	private _insertNewText(newText: string) {

		if (this._selectionBeginIndex != this._selectionEndIndex) {
			const textBeforeCursor: string = this._iText.slice(0, this._selectionBeginIndex);
			const textAfterCursor: string = this._iText.slice(this._selectionEndIndex, this._iText.length);
			if (this.maxChars > 0
				&& (textBeforeCursor.length + textAfterCursor.length + newText.length) > this.maxChars) {
				const maxNewChars: number = this.maxChars - textBeforeCursor.length + textAfterCursor.length;
				if (maxNewChars > 0) {
					newText = newText.slice(0, maxNewChars);
				}
			}
			this.text = textBeforeCursor + newText + textAfterCursor;
			this._textShapesDirty = true;
			this._selectionBeginIndex += 1;
			this._selectionEndIndex = this._selectionBeginIndex;
		} else {
			if (this.maxChars > 0 && this._iText.length >= this.maxChars) {
				// do nothing
			} else {
				const textBeforeCursor: string = this._iText.slice(0, this._selectionBeginIndex);
				const textAfterCursor: string = this._iText.slice(this._selectionEndIndex, this._iText.length);
				this.text = textBeforeCursor + newText + textAfterCursor;
				this._textShapesDirty = true;
				this._selectionBeginIndex += 1;
				this._selectionEndIndex = this._selectionBeginIndex;
			}
		}
	}

	public clone(): TextField {
		const newInstance: TextField = TextField.getNewTextField();

		this.copyTo(newInstance);

		return newInstance;
	}

	public copyTo(newInstance: TextField): void {
		super.copyTo(newInstance);
		newInstance.autoSize = this.autoSize;
		newInstance.type = this._type;
		newInstance.html = this.html;
		newInstance.width = this._width;
		newInstance.height = this._height;
		if (this._textFormat)
			newInstance.textFormat = this._textFormat.clone();
		newInstance.textColor = this._textColor;
		newInstance.border = this._border;
		newInstance.borderColor = this._borderColor;
		newInstance.background = this._background;
		newInstance.backgroundColor = this._backgroundColor;
		newInstance.textOffsetX = this.textOffsetX;
		newInstance.textOffsetY = this.textOffsetY;
		newInstance.staticMatrix = this.staticMatrix;
		newInstance.selectable = this._selectable;
		newInstance.multiline = this.multiline;
		newInstance.wordWrap = this.wordWrap;
		newInstance.maxChars = this.maxChars;
		newInstance.sourceTextField = this;

		if (newInstance.html) {
			newInstance.htmlText = this.htmlText;
		} else {
			newInstance.text = this.text;
		}
		if (this._labelData) {
			newInstance.setLabelData(this._labelData);
		}
	}

	private _clearTextShapes(): void {
		this._textShapesDirty = false;

		this._lastWordsCount = 0;

		if (this.targetGraphics)
			this.targetGraphics.clear();

		let textShape: TextShape;
		for (const key in this.textShapes) {

			textShape = this.textShapes[key];
			if (textShape.shape) {
				textShape.shape.dispose();
			}

			textShape.shape = null;
			textShape.elements = null;
			textShape.length = 0;

			delete this.textShapes[key];
		}
	}

}

PartitionBase.registerAbstraction(EntityNode, TextField);