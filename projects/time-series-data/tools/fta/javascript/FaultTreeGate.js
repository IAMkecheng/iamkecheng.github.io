var FaultTreeGate = (function (_super) {
	__extends(FaultTreeGate, _super);
	function FaultTreeGate(pPosition) {
		_super.call(this);
		this.mChildren = new Array();
	}
	FaultTreeGate.prototype.getChild = function (pIndex) {
		return this.mChildren[pIndex];
	};
	FaultTreeGate.prototype.numChildren = function () {
		return this.mChildren.length;
	};
	FaultTreeGate.prototype.addChild = function (pChild) {
		this.mChildren.push(pChild);
	};

	//var maxDepth = 0;

	FaultTreeGate.prototype.drawChild = function (pContext) {
		var totalWidth = this.branchWidth();
		var prevChildWidth = 0; // initial width set to 0
		var prevChildWidthTotal = 0; // initial total width set to 0

		// 确保有子节点时才绘制
		if (this.numChildren() === 0) {
			return;
		}

		for (var i = 0; i < this.numChildren(); i += 1) {
			pContext.save();
			var child = this.getChild(i);
			var childWidth = child.branchWidth();

			// 确保子节点有有效的最小宽度
			if (childWidth <= 0) {
				childWidth = 120; // 默认最小宽度
			}

			pContext.strokeStyle = '#000000'; // setting the stroke to black
			pContext.lineWidth = 5; // 连接线始终使用默认粗细
			pContext.moveTo(-totalWidth / 2 + childWidth / 2 + prevChildWidthTotal, 75);
			pContext.lineTo(totalWidth / 4 + -childWidth / 4 + -prevChildWidthTotal / 4, 75); // Drawing the branch lines
			pContext.stroke();

			// 计算子节点位置并更新
			var childX = -totalWidth / 2 + childWidth / 2 + prevChildWidthTotal;
			var childY = 150;

			// 计算子节点的绝对位置
			var absoluteChildX = this.getPosition().getX() + childX;
			var absoluteChildY = this.getPosition().getY() + childY;
			var childPosition = new Vector(absoluteChildX, absoluteChildY);
			child.setPosition(childPosition);

			pContext.translate(childX, childY); // Translating all of the children 
			child.draw(pContext);
			prevChildWidth = childWidth;
			prevChildWidthTotal += prevChildWidth;
			pContext.restore();
		}
	};

	FaultTreeGate.prototype.branchWidth = function () {
		var width = 0;
		for (var i = 0; i < this.numChildren(); i += 1) {
			var childWidth = this.getChild(i).branchWidth();
			// 确保子节点有有效的最小宽度
			if (childWidth <= 0) {
				childWidth = 120; // 默认最小宽度
			}
			width += childWidth; // looping through the children and adding
		}		                  // their width to the overall branchWidth
		// 确保门节点有最小宽度
		return Math.max(width, 120);
	};

	/*
	FaultTreeGate.prototype.maxTreeDepth = function () {
		maxDepth = 0;
		depth = 0;
		
		if (depth > maxDepth) {
			maxDepth = depth;
		}
		for (var i = 0; i < this.numChildren(); i += 1) {
			depth += 1;
			this.mChildren[i].maxTreeDepth();
		}	
		return maxDepth;
	}
	*/

	return FaultTreeGate;
})(FaultTreeNode);
