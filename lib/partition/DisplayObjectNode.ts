import AssetEvent					from "awayjs-core/lib/events/AssetEvent";
import IAbstractionPool				from "awayjs-core/lib/library/IAbstractionPool";
import AbstractionBase				from "awayjs-core/lib/library/AbstractionBase";

import Plane3D						from "awayjs-core/lib/geom/Plane3D";
import Vector3D						from "awayjs-core/lib/geom/Vector3D";

import DisplayObject				from "awayjs-display/lib/display/DisplayObject";
import AxisAlignedBoundingBox		from "awayjs-display/lib/bounds/AxisAlignedBoundingBox";
import BoundingSphere				from "awayjs-display/lib/bounds/BoundingSphere";
import BoundingVolumeBase			from "awayjs-display/lib/bounds/BoundingVolumeBase";
import BoundsType					from "awayjs-display/lib/bounds/BoundsType";
import NullBounds					from "awayjs-display/lib/bounds/NullBounds";
import SceneGraphNode				from "awayjs-display/lib/partition/SceneGraphNode";
import ITraverser					from "awayjs-display/lib/ITraverser";
import IEntity						from "awayjs-display/lib/display/IEntity";
import DisplayObjectEvent			from "awayjs-display/lib/events/DisplayObjectEvent";
import INode						from "awayjs-display/lib/partition/INode";

/**
 * @class away.partition.EntityNode
 */
class DisplayObjectNode extends AbstractionBase implements INode
{
	public numEntities:number = 0;

	public isSceneGraphNode:boolean = false;

	public _iUpdateQueueNext:DisplayObjectNode;

	private _onInvalidatePartitionBoundsDelegate:(event:DisplayObjectEvent) => void;
	
	public _displayObject:DisplayObject;
	private _boundsDirty:boolean = true;
	private _bounds:BoundingVolumeBase;

	public _iCollectionMark:number;// = 0;

	public parent:SceneGraphNode;

	private _boundsType:string;

	public get debugVisible():boolean
	{
		return this._displayObject.debugVisible;
	}

	/**
	 * @internal
	 */
	public get bounds():BoundingVolumeBase
	{
		if (this._boundsDirty)
			this._updateBounds();

		return this._bounds;
	}

	constructor(displayObject:DisplayObject, pool:IAbstractionPool)
	{
		super(displayObject, pool);

		this._onInvalidatePartitionBoundsDelegate = (event:DisplayObjectEvent) => this._onInvalidatePartitionBounds(event);

		this._displayObject = displayObject;
		this._displayObject.addEventListener(DisplayObjectEvent.INVALIDATE_PARTITION_BOUNDS, this._onInvalidatePartitionBoundsDelegate);

		this._boundsType = this._displayObject.boundsType;
	}

	/**
	 *
	 * @returns {boolean}
	 */
	public isCastingShadow():boolean
	{
		return this._displayObject.castsShadows;
	}

	public onClear(event:AssetEvent)
	{
		super.onClear(event);

		this._displayObject.removeEventListener(DisplayObjectEvent.INVALIDATE_PARTITION_BOUNDS, this._onInvalidatePartitionBoundsDelegate);
		this._displayObject = null;

		if (this._bounds)
			this._bounds.dispose();

		this._bounds = null;
	}

	public onInvalidate(event:AssetEvent)
	{
		super.onInvalidate(event);

		if (this._boundsType != this._displayObject.boundsType) {
			this._boundsType = this._displayObject.boundsType;
			this._boundsDirty = true;
		}
	}

	/**
	 *
	 * @param planes
	 * @param numPlanes
	 * @returns {boolean}
	 */
	public isInFrustum(planes:Array<Plane3D>, numPlanes:number):boolean
	{
		return true;
	}


	/**
	 * @inheritDoc
	 */
	public isIntersectingRay(rayPosition:Vector3D, rayDirection:Vector3D):boolean
	{
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public acceptTraverser(traverser:ITraverser)
	{
		// do nothing here
	}

	public _onInvalidatePartitionBounds(event:DisplayObjectEvent)
	{
		// do nothing here
	}

	private _updateBounds()
	{
		if (this._bounds)
			this._bounds.dispose();

		if (this._boundsType == BoundsType.AXIS_ALIGNED_BOX)
			this._bounds = new AxisAlignedBoundingBox(this._displayObject);
		else if (this._boundsType == BoundsType.SPHERE)
			this._bounds = new BoundingSphere(this._displayObject);
		else if (this._boundsType == BoundsType.NULL)
			this._bounds = new NullBounds();

		this._boundsDirty = false;
	}
}

export default DisplayObjectNode;