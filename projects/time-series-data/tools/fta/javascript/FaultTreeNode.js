var FaultTreeNode = (function () {
    function FaultTreeNode() {
        this.setId(FaultTreeNode.sTotalNodes++);
        this.mText = "\u8282\u70b9" + this.mId; // default label
        this.mIsSelected = false;
        this.mIsEditing = false;
        this.mPosition = new Vector(0, 0);
    }
    FaultTreeNode.sTotalNodes = 0;
    FaultTreeNode.prototype.getId = function () {
        return this.mId;
    };
    FaultTreeNode.prototype.setId = function (pId) {
        this.mId = pId;
    };
    FaultTreeNode.prototype.getText = function () {
        return this.mText;
    };
    FaultTreeNode.prototype.setText = function (pText) {
        this.mText = pText;
    };
    FaultTreeNode.prototype.isSelected = function () {
        return this.mIsSelected;
    };
    FaultTreeNode.prototype.setSelected = function (pSelected) {
        this.mIsSelected = pSelected;
    };
    FaultTreeNode.prototype.isEditing = function () {
        return this.mIsEditing;
    };
    FaultTreeNode.prototype.setEditing = function (pEditing) {
        this.mIsEditing = pEditing;
    };
    FaultTreeNode.prototype.getPosition = function () {
        return this.mPosition;
    };
    FaultTreeNode.prototype.setPosition = function (pPosition) {
        this.mPosition = pPosition;
    };
    // 检查点是否在节点内部
    FaultTreeNode.prototype.isPointInside = function (pPoint, pContext) {
        // 子类需要重写此方法
        return false;
    };
    // 绘制文本
    FaultTreeNode.prototype.drawText = function (pContext) {
        if (!this.mText) return;

        pContext.save();
        pContext.font = '14px "PingFang SC", "Microsoft YaHei", "Heiti SC", "Noto Sans SC", sans-serif';
        pContext.fillStyle = this.mIsSelected ? '#ff0000' : '#000000';
        pContext.textAlign = 'center';
        pContext.textBaseline = 'middle';

        // 文本换行处理
        var lines = this.mText.split('\n');
        var lineHeight = 16;
        var startY = -lines.length * lineHeight / 2;

        for (var i = 0; i < lines.length; i++) {
            pContext.fillText(lines[i], 0, startY + i * lineHeight);
        }

        pContext.restore();
    };
    FaultTreeNode.prototype.draw = function (context) {

    };

    return FaultTreeNode;
})();
