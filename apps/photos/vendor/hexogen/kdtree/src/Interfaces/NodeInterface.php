<?php

namespace Hexogen\KDTree\Interfaces;

interface NodeInterface
{
    /**
     * @return ItemInterface
     */
    public function getItem(): ItemInterface;

    /**
     * @param NodeInterface $node
     */
    public function setRight(NodeInterface $node): void;

    /**
     * @param NodeInterface $node
     */
    public function setLeft(NodeInterface $node): void;

    /**
     * @return NodeInterface|null
     */
    public function getRight(): ?NodeInterface;

    /**
     * @return NodeInterface|null
     */
    public function getLeft(): ?NodeInterface;
}
