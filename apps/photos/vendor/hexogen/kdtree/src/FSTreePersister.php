<?php

namespace Hexogen\KDTree;

use Hexogen\KDTree\Interfaces\ItemInterface;
use Hexogen\KDTree\Interfaces\KDTreeInterface;
use Hexogen\KDTree\Interfaces\NodeInterface;
use Hexogen\KDTree\Interfaces\TreePersisterInterface;

class FSTreePersister implements TreePersisterInterface
{
    /**
     * @var string path to the file
     */
    private $path;

    /**
     * @var resource file handler
     */
    private $handler;

    /**
     * @var int
     */
    private $dimensions;

    /**
     * @var int
     */
    private $nodeMemorySize;

    public function __construct(string $path)
    {
        $this->path = $path;
    }

    /**
     * @api
     * @param KDTreeInterface $tree
     * @param string $identifier that identifies persisted tree(may be a filename, database name etc.)
     * @return mixed
     */
    public function convert(KDTreeInterface $tree, string $identifier)
    {
        $this->initTree($identifier);

        $this->dimensions = $tree->getDimensionCount();

        $this->calculateNodeSize();

        $this->specifyNumberOfDimensions();

        $this->specifyNumberOfItems($tree);

        $upperBound = $tree->getMaxBoundary();
        $this->writeCoordinate($upperBound);

        $lowerBound = $tree->getMinBoundary();
        $this->writeCoordinate($lowerBound);

        $root  = $tree->getRoot();
        if ($root) {
            $this->writeNode($root);
        }
        fclose($this->handler);
    }

    /**
     * @param NodeInterface $node
     */
    private function writeNode(NodeInterface $node)
    {
        $position = ftell($this->handler);
        $item = $node->getItem();

        $this->writeItemId($item);

        $dataChunk = pack('V', 0); // left position currently unknown so it equal 0/null
        fwrite($this->handler, $dataChunk);

        $rightNode = $node->getRight();

        $rightPosition = 0;
        if ($rightNode) {
            $rightPosition = $position + $this->nodeMemorySize;
        }
        $dataChunk = pack('V', $rightPosition);
        fwrite($this->handler, $dataChunk);

        $this->saveItemCoordinate($item);

        if ($rightNode) {
            $this->writeNode($rightNode);
        }

        $leftNode = $node->getLeft();

        if ($leftNode == null) {
            return;
        }
        $this->persistLeftLink($position);
        $this->writeNode($leftNode);
    }

    /**
     * @param array $coordinate
     */
    private function writeCoordinate(array $coordinate)
    {
        $dataChunk = pack('d'.$this->dimensions, ...$coordinate);
        fwrite($this->handler, $dataChunk);
    }

    /**
     * @param string $identifier
     */
    private function initTree(string $identifier)
    {
        $this->handler = fopen($this->path . '/' . $identifier, 'wb');
    }

    /**
     * Calculate memory size in file needed for single node
     */
    private function calculateNodeSize()
    {
        $this->nodeMemorySize = 3 * FSKDTree::INT_LENGTH + $this->dimensions * FSKDTree::FLOAT_LENGTH;
    }

    /**
     * Specify number of dimensions according to file format
     */
    private function specifyNumberOfDimensions()
    {
        $dataChunk = pack('V', $this->dimensions);
        fwrite($this->handler, $dataChunk);
    }

    /**
     * @param KDTreeInterface $tree
     */
    private function specifyNumberOfItems(KDTreeInterface $tree)
    {
        $itemCount = $tree->getItemCount();
        $dataChunk = pack('V', $itemCount);
        fwrite($this->handler, $dataChunk);
    }

    /**
     * @param $item
     */
    private function saveItemCoordinate(ItemInterface $item)
    {
        $coordinate = [];
        for ($i = 0; $i < $this->dimensions; $i++) {
            $coordinate[] = $item->getNthDimension($i);
        }
        $this->writeCoordinate($coordinate);
    }

    /**
     * Persist current position before writing left node
     * @param int $position
     */
    private function persistLeftLink(int $position)
    {
        $leftPosition = ftell($this->handler);
        fseek($this->handler, $position + FSKDTree::INT_LENGTH);
        $dataChunk = pack('V', $leftPosition);
        fwrite($this->handler, $dataChunk);
        fseek($this->handler, $leftPosition);
    }

    /**
     * @param $item
     */
    private function writeItemId(ItemInterface $item)
    {
        $itemId = $item->getId();
        $dataChunk = pack('V', $itemId);
        fwrite($this->handler, $dataChunk);
    }
}
