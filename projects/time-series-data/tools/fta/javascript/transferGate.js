var TransferGate = (function (_super) {
	__extends(TransferGate, _super);
	function TransferGate(pPosition) {
		_super.call(this);
		this.mText = "\u8f6c\u79fb\u95e8" + this.mId;
	}
	// this function is used by the recursive function in FaultTreeGate
	// to get the width of the TransferGate
	TransferGate.prototype.branchWidth = function (pContext) {
		var width = 120;

		return width;
	}

	TransferGate.prototype.maxTreeDepth = function (pContext) {

		depth += 1;

		return depth;
	}

	TransferGate.prototype.draw = function (pContext) {
		pContext.save();
		pContext.lineWidth = this.mIsSelected ? 8 : 5;
		pContext.strokeStyle = this.mIsSelected ? '#ff0000' : '#000000';
		this.drawTransferGate(pContext); // drawing the TransferGate
		this.drawText(pContext);
		pContext.restore();
	}

	TransferGate.prototype.drawTransferGate = function (pContext) {
		var centerX = 0; // centre points which are drawn around to make the TransferGate
		var centerY = 0;
		var numSegments = 3; // 3 segments, drawing a triangle
		var radius = 50; // setting the radius of the object
		pContext.beginPath();
		pContext.strokeStyle = '#000000'; // setting stroke colour to black
		var anglePerSegment = Math.PI * 2 / numSegments;
		pContext.save();
		pContext.rotate(-Math.PI / 2);
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
		pContext.restore();
		pContext.moveTo(0, -50); // drawing the line which goes above the TransferGate
		pContext.lineTo(0, -77.5);
		pContext.stroke();
	}

	// 检查点是否在转移门内部
	TransferGate.prototype.isPointInside = function (pPoint, pContext) {
		var dx = pPoint.getX() - this.mPosition.getX();
		var dy = pPoint.getY() - this.mPosition.getY();
		var distance = Math.sqrt(dx * dx + dy * dy);
		return distance <= 50; // 半径50
	};

	return TransferGate;
})(FaultTreeNode);
