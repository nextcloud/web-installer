<?php


namespace Hexogen\KDTree;

use Hexogen\KDTree\Interfaces\ItemFactoryInterface;
use Hexogen\KDTree\Interfaces\ItemInterface;
use Hexogen\KDTree\Interfaces\NodeInterface;

class FSNode implements NodeInterface
{
    /**
     * @var ItemInterface item that belongs to the node
     */
    private $item;

    /**
     * @var NodeInterface|null link to the left node
     */
    private $left;

    /**
     * @var int left node offset in file
     */
    private $leftPosition;

    /**
     * @var NodeInterface|null right node link
     */
    private $right;

    /**
     * @var int right node offset in the file
     */
    private $rightPosition;

    /**
     * @var resource file handler
     */
    private $handler;

    /**
     * @var int node start position in the file
     */
    private $position;

    /**
     * @var ItemFactoryInterface item factory
     */
    private $factory;

    /**
     * @var int num of dimensions it item
     */
    private $dimensions;

    /**
     * FSNode constructor.
     * @param ItemFactoryInterface $factory
     * @param resource $handler file handler
     * @param int $position node start position in the file
     * @param int $dimensions number of dimensions in item
     */
    public function __construct(ItemFactoryInterface $factory, $handler, int $position, int $dimensions)
    {
        $this->item = null;
        $this->left = null;
        $this->right = null;
        $this->handler = $handler;
        $this->position = $position;
        $this->factory = $factory;
        $this->dimensions = $dimensions;
    }

    /**
     * @return ItemInterface get item from the node
     */
    public function getItem() : ItemInterface
    {
        if ($this->item == null) {
            $this->readNode();
        }
        return $this->item;
    }

    /**
     * @param NodeInterface $node set right node
     */
    public function setRight(NodeInterface $node): void
    {
        $this->right = $node;
    }

    /**
     * @param NodeInterface $node set left node
     */
    public function setLeft(NodeInterface $node): void
    {
        $this->left = $node;
    }

    /**
     * Returns right node if it exists, null otherwise
     * @return NodeInterface|null get right node
     */
    public function getRight(): ?NodeInterface
    {
        if ($this->rightPosition === null) {
            $this->readNode();
        }
        if ($this->right === null && $this->rightPosition !== 0) {
            $rightNode = new FSNode($this->factory, $this->handler, $this->rightPosition, $this->dimensions);
            $this->setRight($rightNode);
        }
        return $this->right;
    }

    /**
     * Returns left node if it exists, null otherwise
     * @return NodeInterface|null left node
     */
    public function getLeft(): ?NodeInterface
    {
        if ($this->leftPosition === null) {
            $this->readNode();
        }
        if ($this->left === null && $this->leftPosition !== 0) {
            $leftNode = new FSNode($this->factory, $this->handler, $this->leftPosition, $this->dimensions);
            $this->setLeft($leftNode);
        }
        return $this->left;
    }

    /**
     * Read node data from the file
     */
    private function readNode()
    {
        fseek($this->handler, $this->position);
        $dataLength = FSKDTree::FLOAT_LENGTH * $this->dimensions;

        $binData = fread($this->handler, FSKDTree::INT_LENGTH);
        $itemId = unpack('V', $binData)[1];

        $binData = fread($this->handler, FSKDTree::INT_LENGTH);
        $this->leftPosition = unpack('V', $binData)[1];

        $binData = fread($this->handler, FSKDTree::INT_LENGTH);
        $this->rightPosition = unpack('V', $binData)[1];

        $binData = fread($this->handler, $dataLength);
        $dValues = unpack('d'.$this->dimensions, $binData);
        $dValues = array_values($dValues);

        $this->item = $this->factory->make($itemId, $dValues);
    }
}
