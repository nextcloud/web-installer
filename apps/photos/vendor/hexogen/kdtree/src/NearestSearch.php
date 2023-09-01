<?php

namespace Hexogen\KDTree;

use Hexogen\KDTree\Exception\ValidationException;
use Hexogen\KDTree\Interfaces\ItemInterface;
use Hexogen\KDTree\Interfaces\NodeInterface;
use Hexogen\KDTree\Interfaces\PointInterface;
use Hexogen\KDTree\Interfaces\SearchAbstract;
use SplPriorityQueue;

class NearestSearch extends SearchAbstract
{
    /**
     * @var SplPriorityQueue
     */
    private $queue;

    /**
     * @var float
     */
    private $maxQueuedDistance;

    /**
     * @var PointInterface
     */
    private $point;

    /**
     * Search items it the tree by given algorithm
     *
     * @api
     * @param PointInterface $point
     * @param int $resultLength
     * @return ItemInterface[]
     */
    public function search(PointInterface $point, int $resultLength = 1) : array
    {
        $this->validatePoint($point);
        $this->point = $point;

        $upperBound = $this->tree->getMaxBoundary();
        $lowerBound = $this->tree->getMinBoundary();
        $root = $this->tree->getRoot();

        if ($root == null) {
            return [];
        }

        /**
         * @var array orthogonal square distances to the point
         */
        $orthogonalDistances = $this->getOrthogonalDistances($point, $upperBound, $lowerBound);

        /**
         * @var float possible Euclidean distance
         */
        $possibleDistance = $this->getPossibleDistance($orthogonalDistances);

        $this->prepareQueue($resultLength);
        $this->searchNearest($root, 0, $upperBound, $lowerBound, $orthogonalDistances, $possibleDistance);

        return $this->getItemsFromQueue();
    }

    /**
     * Check that point has same number of dimensions that all items in the tree
     *
     * @param PointInterface $point
     * @throws ValidationException
     */
    private function validatePoint(PointInterface $point)
    {
        if ($point->getDimensionsCount() !== $this->tree->getDimensionCount()) {
            throw new ValidationException(
                'point dimensions count should be equal to ' . $this->tree->getDimensionCount()
            );
        }
    }

    /**
     * Get orthogonal distances array from the point to multidimensional space that holds all the items in the tree
     *
     * @param PointInterface $point
     * @param array $upperBound
     * @param array $lowerBound
     * @return array
     */
    private function getOrthogonalDistances(PointInterface $point, array $upperBound, array $lowerBound): array
    {
        $orthogonalDistances = [];

        for ($i = 0; $i < $this->dimensions; $i++) {
            $coordinate = $point->getNthDimension($i);
            $orthogonalDistances[$i] = $this->getPossibleOrthogonalDistance(
                $coordinate,
                $upperBound[$i],
                $lowerBound[$i]
            );
        }
        return $orthogonalDistances;
    }

    /**
     * Calculate minimal possible Euclidean distance from the point to an item
     *
     * @param $orthogonalDistances
     * @return float
     */
    private function getPossibleDistance(array $orthogonalDistances) : float
    {
        $possibleDistance = 0.;
        foreach ($orthogonalDistances as $orthogonalDistance) {
            $possibleDistance += $orthogonalDistance;
        }

        return $possibleDistance;
    }

    /**
     * Prepare queue for collecting nearest items.
     * Queue size sets to be equal to result length or to tree size,
     * if request result length is bigger then tree size
     *
     * @param int $resultLength
     * @return SplPriorityQueue
     */
    private function prepareQueue(int $resultLength)
    {
        $this->queue = new SplPriorityQueue();
        $this->queue->setExtractFlags(SplPriorityQueue::EXTR_PRIORITY);

        $itemsInTree = $this->tree->getItemCount();

        if ($itemsInTree < $resultLength) {
            $resultLength = $itemsInTree;
        }

        for ($i = 0; $i < $resultLength; $i++) {
            $this->queue->insert(null, INF);
        }

        $this->maxQueuedDistance = INF;
    }

    /**
     * Add an item to the queue if distance to the point is less than max queued,
     * after it removes an item with the biggest distance, to keep queue size constant
     *
     * @param ItemInterface $item
     * @param float $distance
     */
    private function addToQueue(ItemInterface $item, float $distance)
    {
        if ($distance >= $this->maxQueuedDistance) {
            return;
        }

        $this->queue->insert($item, $distance);
        $this->queue->extract();

        $this->maxQueuedDistance = $this->queue->current();
    }

    /**
     * Calculate Euclidean distance between point and item
     *
     * @param ItemInterface $item
     * @param PointInterface $point
     * @return float
     */
    private function calculateDistance(ItemInterface $item, PointInterface $point) : float
    {
        $distance = 0.;
        for ($i = 0; $i < $this->dimensions; $i++) {
            $distance += pow($item->getNthDimension($i) - $point->getNthDimension($i), 2);
        }
        return $distance;
    }

    /**
     * Recursive search of N closest item in the tree to the given point
     *
     * @param NodeInterface $node
     * @param int $dimension
     * @param array $upperBound
     * @param array $lowerBound
     * @param array $orthogonalDistances
     * @param float $possibleDistance
     */
    private function searchNearest(
        NodeInterface $node,
        int $dimension,
        array $upperBound,
        array $lowerBound,
        array $orthogonalDistances,
        float $possibleDistance
    ) {
        $item = $node->getItem();
        $distance = $this->calculateDistance($item, $this->point);
        $this->addToQueue($item, $distance);

        $rightLowerBound = $lowerBound;
        $leftUpperBound = $upperBound;
        $rightLowerBound[$dimension] = $item->getNthDimension($dimension);
        $leftUpperBound[$dimension] = $item->getNthDimension($dimension);

        $rightNode = $node->getRight();
        $leftNode = $node->getLeft();

        if ($rightNode && $leftNode) {
            $this->smartBranchesSearch(
                $rightNode,
                $leftNode,
                $dimension,
                $upperBound,
                $rightLowerBound,
                $leftUpperBound,
                $lowerBound,
                $orthogonalDistances,
                $possibleDistance
            );
            return;
        }

        if ($rightNode) {
            $this->branchSearch(
                $rightNode,
                $dimension,
                $upperBound,
                $rightLowerBound,
                $orthogonalDistances,
                $possibleDistance
            );
        }

        if ($leftNode) {
            $this->branchSearch(
                $leftNode,
                $dimension,
                $leftUpperBound,
                $lowerBound,
                $orthogonalDistances,
                $possibleDistance
            );
        }
    }

    /**
     * Get Euclidean distance between point and an item in given dimension
     *
     * @param $pointCoordinate
     * @param $upperBound
     * @param $lowerBound
     * @return float|number
     */
    private function getPossibleOrthogonalDistance($pointCoordinate, $upperBound, $lowerBound)
    {
        if ($pointCoordinate > $upperBound) {
            return pow($pointCoordinate - $upperBound, 2);
        } elseif ($pointCoordinate < $lowerBound) {
            return pow($lowerBound - $pointCoordinate, 2);
        }
        return 0.;
    }

    /**
     * Recursive search in the given branch
     *
     * @param NodeInterface $branchNode
     * @param int $dimension
     * @param array $upperBound
     * @param array $lowerBound
     * @param array $orthogonalDistances
     * @param float $possibleDistance
     */
    private function branchSearch(
        NodeInterface $branchNode,
        int $dimension,
        array $upperBound,
        array  $lowerBound,
        array $orthogonalDistances,
        float $possibleDistance
    ) {

        // possible orthogonal distances to the right node
        $branchOrthogonalDistances = $orthogonalDistances;
        $branchPossibleDistance = $possibleDistance;

        $nextDimension = ($dimension + 1) % $this->dimensions;

        $branchOrthogonalDistances[$dimension] = $this->getPossibleOrthogonalDistance(
            $this->point->getNthDimension($dimension),
            $upperBound[$dimension],
            $lowerBound[$dimension]
        );

        if ($orthogonalDistances[$dimension] != $branchOrthogonalDistances[$dimension]) {
            $branchPossibleDistance += $branchOrthogonalDistances[$dimension] - $orthogonalDistances[$dimension];
        }

        if ($branchPossibleDistance <= $this->maxQueuedDistance) {
            $this->searchNearest(
                $branchNode,
                $nextDimension,
                $upperBound,
                $lowerBound,
                $branchOrthogonalDistances,
                $branchPossibleDistance
            );
        }
    }

    /**
     * extract all items from queue
     */
    private function getItemsFromQueue() : array
    {
        $items = [];
        $this->queue->setExtractFlags(SplPriorityQueue::EXTR_DATA);

        while (!$this->queue->isEmpty()) {
            $items[] = $this->queue->extract();
        }

        return array_reverse($items);
    }

    /**
     * Nearest branch first approach
     *
     * @param NodeInterface $rightNode
     * @param NodeInterface $leftNode
     * @param int $dimension
     * @param array $upperBound
     * @param array $rightLowerBound
     * @param array $leftUpperBound
     * @param array $lowerBound
     * @param array $orthogonalDistances
     * @param float $possibleDistance
     */
    private function smartBranchesSearch(
        NodeInterface $rightNode,
        NodeInterface $leftNode,
        int $dimension,
        array $upperBound,
        array $rightLowerBound,
        array $leftUpperBound,
        array $lowerBound,
        array $orthogonalDistances,
        float $possibleDistance
    ) {

        // possible orthogonal distances to the right node
        $leftOrthogonalDistances = $rightOrthogonalDistances = $orthogonalDistances;
        $leftPossibleDistance = $rightPossibleDistance = $possibleDistance;

        $nextDimension = ($dimension + 1) % $this->dimensions;

        $leftOrthogonalDistances[$dimension] = $this->getPossibleOrthogonalDistance(
            $this->point->getNthDimension($dimension),
            $leftUpperBound[$dimension],
            $lowerBound[$dimension]
        );
        $rightOrthogonalDistances[$dimension] = $this->getPossibleOrthogonalDistance(
            $this->point->getNthDimension($dimension),
            $upperBound[$dimension],
            $rightLowerBound[$dimension]
        );

        if ($orthogonalDistances[$dimension] != $leftOrthogonalDistances[$dimension]) {
            $leftPossibleDistance += $leftOrthogonalDistances[$dimension] - $orthogonalDistances[$dimension];
        }

        if ($orthogonalDistances[$dimension] != $rightOrthogonalDistances[$dimension]) {
            $rightPossibleDistance += $rightOrthogonalDistances[$dimension] - $orthogonalDistances[$dimension];
        }

        if ($leftPossibleDistance < $rightPossibleDistance) {
            $this->prioritySearch(
                $leftNode,
                $rightNode,
                $leftUpperBound,
                $lowerBound,
                $upperBound,
                $rightLowerBound,
                $leftOrthogonalDistances,
                $rightOrthogonalDistances,
                $leftPossibleDistance,
                $rightPossibleDistance,
                $nextDimension
            );
            return;
        }

        $this->prioritySearch(
            $rightNode,
            $leftNode,
            $upperBound,
            $rightLowerBound,
            $leftUpperBound,
            $lowerBound,
            $rightOrthogonalDistances,
            $leftOrthogonalDistances,
            $rightPossibleDistance,
            $leftPossibleDistance,
            $nextDimension
        );
    }

    public function prioritySearch(
        NodeInterface $firstNode,
        NodeInterface $secondNode,
        array $firstUpperBound,
        array $firstLowerBound,
        array $secondUpperBound,
        array $secondLowerBound,
        array $firstOrthogonalDistances,
        array $secondOrthogonalDistances,
        float $firstPossibleDistance,
        float $secondPossibleDistance,
        int $nextDimension
    ) {

        if ($firstPossibleDistance < $this->maxQueuedDistance) {
            $this->searchNearest(
                $firstNode,
                $nextDimension,
                $firstUpperBound,
                $firstLowerBound,
                $firstOrthogonalDistances,
                $firstPossibleDistance
            );
            if ($secondPossibleDistance < $this->maxQueuedDistance) {
                $this->searchNearest(
                    $secondNode,
                    $nextDimension,
                    $secondUpperBound,
                    $secondLowerBound,
                    $secondOrthogonalDistances,
                    $secondPossibleDistance
                );
            }
        }
    }
}
