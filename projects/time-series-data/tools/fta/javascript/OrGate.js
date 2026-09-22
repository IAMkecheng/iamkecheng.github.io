var OrGate = (function (_super) {
	__extends(OrGate, _super);
	function OrGate(pPosition) {
		_super.call(this);
		this.mText = "\u6216\u95e8" + this.mId;
	}

	OrGate.prototype.draw = function (pContext) {
		pContext.save();
		pContext.lineWidth = this.mIsSelected ? 8 : 5;
		pContext.strokeStyle = this.mIsSelected ? '#ff0000' : '#000000';
		this.drawOrGate(pContext); // drawing the OrGate
		this.drawText(pContext);
		pContext.restore();

		// 绘制子节点时使用独立的上下文状态，确保子节点不受父节点选中状态影响
		pContext.save();
		this.drawChild(pContext); // drawing any children the OrGate has
		pContext.restore();
	};

	OrGate.prototype.drawOrGate = function (pContext) {
		pContext.save();
		pContext.beginPath();
		pContext.strokeStyle = '#000000'; // setting stroke colour to black
		// 不设置lineWidth，使用父方法中设置的lineWidth（选中时为8，未选中时为5）
		pContext.moveTo(0, -50);
		pContext.bezierCurveTo(0, -50, -60, 0, -50, 50); // left curve
		pContext.bezierCurveTo(-50, 50, 0, 10, 50, 50); // bottom curve
		pContext.bezierCurveTo(50, 50, 60, 0, 0, -50); // right curve, this way all lines connect 
		pContext.moveTo(0, -50); // drawing the small lines which go above and below the OrGate for connecting to branches
		pContext.lineTo(0, -77.5);
		pContext.moveTo(0, 35);
		pContext.lineTo(0, 75);
		pContext.stroke();
		pContext.restore();
	};

	// 检查点是否在或门内部（简化版本，检查是否在椭圆区域内）
	OrGate.prototype.isPointInside = function (pPoint, pContext) {
		var dx = pPoint.getX() - this.mPosition.getX();
		var dy = pPoint.getY() - this.mPosition.getY();

		// 简化的椭圆检测
		var a = 50; // 半长轴
		var b = 50; // 半短轴
		var normalizedX = dx / a;
		var normalizedY = dy / b;

		return (normalizedX * normalizedX + normalizedY * normalizedY) <= 1;
	};

	return OrGate;
})(FaultTreeGate);
