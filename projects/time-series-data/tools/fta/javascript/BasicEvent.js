var BasicEvent = (function (_super) {
	__extends(BasicEvent, _super);
	function BasicEvent(pPosition) {
		_super.call(this);
		this.mText = "\u57fa\u672c\u4e8b\u4ef6" + this.mId;
	}
	// this function is used by the recursive function in FaultTreeGate
	// to get the width of the TransferGate	
	BasicEvent.prototype.branchWidth = function (pContext) {
		var width = 120;

		return width;
	};

	BasicEvent.prototype.maxTreeDepth = function (pContext) {

		depth += 1;

		return depth;
	}

	BasicEvent.prototype.draw = function (pContext) {
		pContext.save();
		pContext.lineWidth = this.mIsSelected ? 8 : 5;
		pContext.strokeStyle = this.mIsSelected ? '#ff0000' : '#000000';
		this.drawBasicEvent(pContext);
		this.drawText(pContext);
		pContext.restore();
	};

	BasicEvent.prototype.drawBasicEvent = function (pContext) {
		pContext.save();
		var centerX = 0; // centre points which are drawn around to make the TransferGate
		var centerY = 0;
		var numSegments = 60; // 40 sided polygon, looks like a circle
		var radius = 50; // setting the radius of the object
		pContext.beginPath();
		pContext.strokeStyle = '#000000'; // setting the stroke to black
		var anglePerSegment = Math.PI * 2 / numSegments;
		// the angle is initially set to zero (first iteration is 0)
		// the angle increases each iteration through the loop
		for (var i = 0; i <= numSegments; i += 1) {
			var angle = anglePerSegment * i;
			var x = centerX + radius * Math.cos(angle);
			var y = centerY + radius * Math.sin(angle);
			if (i == 0) {
				pContext.moveTo(x, y);
			}
			else {
				pContext.lineTo(x, y);
			}
		}
		pContext.closePath();
		pContext.moveTo(0, -77.5); // drawing the line above the BasicEvent
		pContext.lineTo(0, -50);
		pContext.stroke();
		pContext.restore();
	}

	// 检查点是否在基本事件内部
	BasicEvent.prototype.isPointInside = function (pPoint, pContext) {
		var dx = pPoint.getX() - this.mPosition.getX();
		var dy = pPoint.getY() - this.mPosition.getY();
		var distance = Math.sqrt(dx * dx + dy * dy);
		return distance <= 50; // 半径50
	};

	return BasicEvent;
})(FaultTreeNode);
