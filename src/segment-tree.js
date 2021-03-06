'use babel'

import Random from 'random-seed'
import {traverse, traversalDistance, compare as comparePoints, min as minPoint, format as formatPoint} from './point-helpers'
import {getExtent, getPrefix, getSuffix} from './text-helpers'

const NOT_DONE = {done: false}
const DONE = {done: true}
const ZERO_POINT = Object.freeze({row: 0, column: 0})
const INFINITY_POINT = Object.freeze({row: Infinity, column: Infinity})

export default class SegmentTree {
  constructor (seed = Date.now()) {
    this.randomGenerator = new Random(seed)
    this.root = null
  }

  buildIterator () {
    return new SegmentTreeIterator(this)
  }

  buildIteratorAtStart () {
    return new SegmentTreeIterator(this, true)
  }

  splice (outputStart, replacedExtent, replacementText) {
    let outputOldEnd = traverse(outputStart, replacedExtent)
    let outputNewEnd = traverse(outputStart, getExtent(replacementText))

    let {startNode, prefix} = this.insertSpliceStart(outputStart)
    let {endNode, suffix, suffixExtent} = this.insertSpliceEnd(outputOldEnd)
    startNode.priority = -1
    this.bubbleNodeUp(startNode)
    endNode.priority = -2
    this.bubbleNodeUp(endNode)

    startNode.right = null
    startNode.inputExtent = startNode.inputLeftExtent
    startNode.outputExtent = startNode.outputLeftExtent

    let endNodeOutputRightExtent = traversalDistance(endNode.outputExtent, endNode.outputLeftExtent)
    endNode.outputLeftExtent = traverse(outputNewEnd, suffixExtent)
    endNode.outputExtent = traverse(endNode.outputLeftExtent, endNodeOutputRightExtent)
    endNode.changeText = prefix + replacementText + suffix

    startNode.priority = this.generateRandom()
    this.bubbleNodeDown(startNode)
    endNode.priority = this.generateRandom()
    this.bubbleNodeDown(endNode)
  }

  insertSpliceStart (spliceOutputStart) {
    let {startNode, endNode, startNodeOutputPosition} = this.insertSpliceBoundary(spliceOutputStart, true)

    let prefix
    if (comparePoints(spliceOutputStart, startNodeOutputPosition) === 0) {
      prefix = ''
    } else {
      prefix = getPrefix(endNode.changeText, traversalDistance(spliceOutputStart, startNodeOutputPosition))
    }

    return {startNode, prefix}
  }

  insertSpliceEnd (spliceOutputEnd) {
    let {startNode, endNode, startNodeOutputPosition, endNodeOutputPosition} = this.insertSpliceBoundary(spliceOutputEnd, false)

    let suffix, suffixExtent
    if (comparePoints(spliceOutputEnd, endNodeOutputPosition) === 0) {
      suffix = ''
      suffixExtent = ZERO_POINT
    } else {
      suffix = getSuffix(endNode.changeText, traversalDistance(spliceOutputEnd, startNodeOutputPosition))
      suffixExtent = traversalDistance(endNodeOutputPosition, spliceOutputEnd)
    }

    return {endNode, suffix, suffixExtent}
  }

  insertSpliceBoundary (boundaryOutputPosition, insertingChangeStart) {
    let node = this.root

    if (!node) {
      this.root = new SegmentTreeNode(null, boundaryOutputPosition, boundaryOutputPosition)
      this.root.isChangeStart = insertingChangeStart
      return buildInsertedNodeResult(this.root)
    }

    let inputOffset = ZERO_POINT
    let outputOffset = ZERO_POINT
    let maxInputPosition = INFINITY_POINT
    let nodeInputPosition, nodeOutputPosition
    let containingStartNode, containingEndNode
    let containingStartNodeOutputPosition, containingEndNodeOutputPosition

    while (true) {
      nodeInputPosition = traverse(inputOffset, node.inputLeftExtent)
      nodeOutputPosition = traverse(outputOffset, node.outputLeftExtent)

      if (node.isChangeStart) {
        let result = visitChangeStart()
        if (result) return result
      } else {
        let result = visitChangeEnd()
        if (result) return result
      }
    }

    function visitChangeStart() {
      if (comparePoints(boundaryOutputPosition, nodeOutputPosition) < 0) { // boundaryOutputPosition < nodeOutputPosition
        containingEndNode = null
        containingEndNodeOutputPosition = null

        if (node.left) {
          descendLeft()
          return null
        } else {
          return insertLeftNode()
        }
      } else { // boundaryOutputPosition >= nodeOutputPosition
        containingStartNode = node
        containingStartNodeOutputPosition = nodeOutputPosition

        if (node.right) {
          descendRight()
          return null
        } else {
          if (insertingChangeStart || containingEndNode) {
            return {
              startNode: containingStartNode,
              endNode: containingEndNode,
              startNodeOutputPosition: containingStartNodeOutputPosition,
              endNodeOutputPosition: containingEndNodeOutputPosition
            }
          } else {
            return insertRightNode()
          }
        }
      }
    }

    function visitChangeEnd () {
      if (comparePoints(boundaryOutputPosition, nodeOutputPosition) <= 0) { // boundaryOutputPosition <= nodeOutputPosition
        containingEndNode = node
        containingEndNodeOutputPosition = nodeOutputPosition

        if (node.left) {
          descendLeft()
          return null
        } else {
          if (!insertingChangeStart || containingStartNode) {
            return {
              startNode: containingStartNode,
              endNode: containingEndNode,
              startNodeOutputPosition: containingStartNodeOutputPosition,
              endNodeOutputPosition: containingEndNodeOutputPosition
            }
          } else {
            return insertLeftNode()
          }
        }
      } else { // boundaryOutputPosition > nodeOutputPosition
        containingStartNode = null
        containingStartNodeOutputPosition = null

        if (node.right) {
          descendRight()
          return null
        } else {
          return insertRightNode()
        }
      }
    }

    function descendLeft () {
      maxInputPosition = nodeInputPosition
      node = node.left
    }

    function descendRight () {
      inputOffset = traverse(inputOffset, node.inputLeftExtent)
      outputOffset = traverse(outputOffset, node.outputLeftExtent)
      node = node.right
    }

    function insertLeftNode () {
      let outputLeftExtent = traversalDistance(boundaryOutputPosition, outputOffset)
      let inputLeftExtent = minPoint(outputLeftExtent, node.inputLeftExtent)
      let newNode = new SegmentTreeNode(node, inputLeftExtent, outputLeftExtent)
      newNode.isChangeStart = insertingChangeStart
      node.left = newNode
      return buildInsertedNodeResult(newNode)
    }

    function insertRightNode () {
      let outputLeftExtent = traversalDistance(boundaryOutputPosition, nodeOutputPosition)
      let inputLeftExtent = minPoint(outputLeftExtent, traversalDistance(maxInputPosition, nodeInputPosition))
      let newNode = new SegmentTreeNode(node, inputLeftExtent, outputLeftExtent)
      newNode.isChangeStart = insertingChangeStart
      node.right = newNode
      return buildInsertedNodeResult(newNode)
    }

    function buildInsertedNodeResult (insertedNode) {
      if (insertingChangeStart) {
        return {
          startNode: insertedNode,
          startNodeOutputPosition: boundaryOutputPosition,
          endNode: containingEndNode,
          endNodeOutputPosition: containingEndNodeOutputPosition
        }
      } else {
        return {
          startNode: containingStartNode,
          startNodeOutputPosition: containingStartNodeOutputPosition,
          endNode: insertedNode,
          endNodeOutputPosition: boundaryOutputPosition
        }
      }
    }
  }

  bubbleNodeUp (node) {
    while (node.parent && node.priority < node.parent.priority) {
      if (node === node.parent.left) {
        this.rotateNodeRight(node)
      } else {
        this.rotateNodeLeft(node)
      }
    }
  }

  bubbleNodeDown (node) {
    while (true) {
      let leftChildPriority = node.left ? node.left.priority : Infinity
      let rightChildPriority = node.right ? node.right.priority : Infinity

      if (leftChildPriority < rightChildPriority && leftChildPriority < node.priority) {
        this.rotateNodeRight(node.left)
      } else if (rightChildPriority < node.priority) {
        this.rotateNodeLeft(node.right)
      } else {
        break
      }
    }
  }

  rotateNodeLeft (pivot) {
    let root = pivot.parent

    if (root.parent) {
      if (root === root.parent.left) {
        root.parent.left = pivot
      } else {
        root.parent.right = pivot
      }
    } else {
      this.root = pivot
    }
    pivot.parent = root.parent

    root.right = pivot.left
    if (root.right) {
      root.right.parent = root
    }

    pivot.left = root
    pivot.left.parent = pivot

    pivot.inputLeftExtent = traverse(root.inputLeftExtent, pivot.inputLeftExtent)
    pivot.inputExtent = traverse(pivot.inputLeftExtent, (pivot.right ? pivot.right.inputExtent : ZERO_POINT))
    root.inputExtent = traverse(root.inputLeftExtent, (root.right ? root.right.inputExtent : ZERO_POINT))

    pivot.outputLeftExtent = traverse(root.outputLeftExtent, pivot.outputLeftExtent)
    pivot.outputExtent = traverse(pivot.outputLeftExtent, (pivot.right ? pivot.right.outputExtent : ZERO_POINT))
    root.outputExtent = traverse(root.outputLeftExtent, (root.right ? root.right.outputExtent : ZERO_POINT))
  }

  rotateNodeRight (pivot) {
    let root = pivot.parent

    if (root.parent) {
      if (root === root.parent.left) {
        root.parent.left = pivot
      } else {
        root.parent.right = pivot
      }
    } else {
      this.root = pivot
    }
    pivot.parent = root.parent

    root.left = pivot.right
    if (root.left) {
      root.left.parent = root
    }

    pivot.right = root
    pivot.right.parent = pivot

    root.inputLeftExtent = traversalDistance(root.inputLeftExtent, pivot.inputLeftExtent)
    root.inputExtent = traversalDistance(root.inputExtent, pivot.inputLeftExtent)
    pivot.inputExtent = traverse(pivot.inputLeftExtent, root.inputExtent)

    root.outputLeftExtent = traversalDistance(root.outputLeftExtent, pivot.outputLeftExtent)
    root.outputExtent = traversalDistance(root.outputExtent, pivot.outputLeftExtent)
    pivot.outputExtent = traverse(pivot.outputLeftExtent, root.outputExtent)
  }

  generateRandom () {
    return this.randomGenerator.random()
  }

  toHTML () {
    return this.root.toHTML()
  }
}

class SegmentTreeIterator {
  constructor (tree, rewind) {
    this.tree = tree
    this.inputOffset = ZERO_POINT
    this.outputOffset = ZERO_POINT
    this.inputOffsetStack = []
    this.outputOffsetStack = []
    this.setNode(tree.root)

    if (rewind && this.node) {
      while (this.node.left) {
        this.descendLeft()
      }
    }
  }

  getInputStart () {
    return this.inputStart
  }

  getInputEnd () {
    return this.inputEnd
  }

  getOutputStart () {
    return this.outputStart
  }

  getOutputEnd () {
    return this.outputEnd
  }

  inChange () {
    return !!this.node && !this.node.isChangeStart
  }

  getChangeText () {
    return this.node.changeText
  }

  setNode (node) {
    this.node = node

    if (node) {
      if (node.left) {
        this.inputStart = traverse(this.inputOffset, node.left.inputExtent)
        this.outputStart = traverse(this.outputOffset, node.left.outputExtent)
      } else {
        this.inputStart = this.inputOffset
        this.outputStart = this.outputOffset
      }

      this.inputEnd = traverse(this.inputOffset, node.inputLeftExtent)
      this.outputEnd = traverse(this.outputOffset, node.outputLeftExtent)
    } else {
      this.inputStart = ZERO_POINT
      this.inputEnd = INFINITY_POINT
      this.outputStart = ZERO_POINT
      this.outputEnd = INFINITY_POINT
    }
  }

  next () {
    if (!this.node) {
      return DONE
    }

    if (this.node.right) {
      this.descendRight()
      while (this.node.left) {
        this.descendLeft()
      }
      return NOT_DONE
    } else {
      while (this.node.parent && this.node.parent.right === this.node) {
        this.ascend()
      }
      if (this.node.parent) {
        this.ascend()
        return NOT_DONE
      } else {
        return DONE
      }
    }
  }

  ascend () {
    this.inputOffset = this.inputOffsetStack.pop()
    this.outputOffset = this.outputOffsetStack.pop()
    this.setNode(this.node.parent)
  }

  descendLeft () {
    this.inputOffsetStack.push(this.inputOffset)
    this.outputOffsetStack.push(this.outputOffset)
    this.setNode(this.node.left)
  }

  descendRight () {
    this.inputOffsetStack.push(this.inputOffset)
    this.outputOffsetStack.push(this.outputOffset)
    this.inputOffset = traverse(this.inputOffset, this.node.inputLeftExtent)
    this.outputOffset = traverse(this.outputOffset, this.node.outputLeftExtent)
    this.setNode(this.node.right)
  }
}

let segmentTreeNodeIdCounter = 0

class SegmentTreeNode {
  constructor(parent, inputLeftExtent, outputLeftExtent) {
    this.parent = parent
    this.left = null
    this.right = null
    this.inputLeftExtent = inputLeftExtent
    this.outputLeftExtent = outputLeftExtent
    this.inputExtent = inputLeftExtent
    this.outputExtent = outputLeftExtent

    this.id = ++segmentTreeNodeIdCounter
    this.priority = Infinity
    this.isChangeStart = false
    this.changeText = null
  }

  toHTML() {
    let s = '<style>';
    s += 'table { width: 100%; }';
    s += 'td { width: 50%; text-align: center; border: 1px solid gray; white-space: nowrap; }';
    s += '</style>';

    s += '<table>';

    s += '<tr>';

    let changeStart = this.isChangeStart ? '&lt;&lt; ' : '';
    let changeEnd = !this.isChangeStart ? ' &gt;&gt;' : '';

    s += '<td colspan="2">' + changeStart + formatPoint(this.inputLeftExtent) + ' / ' + formatPoint(this.outputLeftExtent) + changeEnd + '</td>';
    s += '</tr>';

    if (this.left || this.right) {
      s += '<tr>';
      s += '<td>';
      if (this.left) {
        s += this.left.toHTML();
      } else {
        s += '&nbsp;';
      }
      s += '</td>';
      s += '<td>';
      if (this.right) {
        s += this.right.toHTML();
      } else {
        s += '&nbsp;';
      }
      s += '</td>';
      s += '</tr>';
    }

    s += '</table>';

    return s;
  }
}
