<?php


namespace Hexogen\KDTree;

use Hexogen\KDTree\Interfaces\NodeInterface;
use Hexogen\KDTree\Interfaces\ItemInterface;

class Node implements NodeInterface
{
    /**
     * @var ItemInterface
     */
    private $item;

    /**
     * @var NodeInterface|null
     */
    private $left;

    /**
     * @var NodeInterface|null
     */
    private $right;

    /**
     * Node constructor.
     * @param ItemInterface $item
     */
    public function __construct(ItemInterface $item)
    {
        $this->item = $item;
        $this->left = null;
        $this->right = null;
    }

    /**
     * @return ItemInterface get item from the node
     */
    public function getItem() : ItemInterface
    {
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
     * @return NodeInterface|null get right node
     */
    public function getRight(): ?NodeInterface
    {
        return $this->right;
    }

    /**
     * @return NodeInterface|null get left node
     */
    public function getLeft(): ?NodeInterface
    {
        return $this->left;
    }
}
