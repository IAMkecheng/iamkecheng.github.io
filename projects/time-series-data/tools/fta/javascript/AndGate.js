var AndGate = (function (_super) {
	__extends(AndGate, _super);
	function AndGate(pPosition) {
		_super.call(this);
		this.mText = "\u4e0e\u95e8" + this.mId;
	}

	AndGate.prototype.draw = function (pContext) {
		pContext.save();
		pContext.lineWidth = this.mIsSelected ? 8 : 5;
		pContext.strokeStyle = this.mIsSelected ? '#ff0000' : '#000000';
		this.drawAndGate(pContext); // drawing the AndGate
		this.drawText(pContext);
		pContext.restore();

		// 绘制子节点时使用独立的上下文状态，确保子节点不受父节点选中状态影响
		pContext.save();
		this.drawChild(pContext); // drawing any children the AndGate has
		pContext.restore();
	};

	AndGate.prototype.drawAndGate = function (pContext) {
		pContext.save();
		pContext.beginPath();
		pContext.strokeStyle = '#000000'; // setting the stroke to black
		pContext.moveTo(50, 0);
		pContext.lineTo(50, 30);
		pContext.lineTo(-50, 30);
		pContext.lineTo(-50, 0);
		pContext.arc(0, 0, 50, Math.PI, 0, false);
		pContext.moveTo(0, -50);
		pContext.lineTo(0, -77.5);
		pContext.moveTo(0, 30);
		pContext.lineTo(0, 75);
		pContext.stroke();
		pContext.restore();
	};

	// 检查点是否在与门内部
	AndGate.prototype.isPointInside = function (pPoint, pContext) {
		var dx = Math.abs(pPoint.getX() - this.mPosition.getX());
		var dy = Math.abs(pPoint.getY() - this.mPosition.getY());

		// 检查是否在矩形区域内
		if (dx <= 50 && dy <= 30) {
			return true;
		}

		// 检查是否在半圆区域内（上半部分）
		if (pPoint.getY() <= this.mPosition.getY()) {
			var distance = Math.sqrt(dx * dx + dy * dy);
			return distance <= 50;
		}

		return false;
	};

	return AndGate;
})(FaultTreeGate);
