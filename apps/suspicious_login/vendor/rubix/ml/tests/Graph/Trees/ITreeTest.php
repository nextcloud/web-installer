<?php

namespace Rubix\ML\Tests\Graph\Trees;

use Rubix\ML\Graph\Trees\Tree;
use Rubix\ML\Graph\Nodes\Depth;
use Rubix\ML\Graph\Trees\ITree;
use Rubix\ML\Graph\Trees\BinaryTree;
use Rubix\ML\Graph\Nodes\BinaryNode;
use Rubix\ML\Datasets\Generators\Blob;
use Rubix\ML\Datasets\Generators\Agglomerate;
use PHPUnit\Framework\TestCase;

/**
 * @group Trees
 * @covers \Rubix\ML\Graph\Trees\ITree
 */
class ITreeTest extends TestCase
{
    protected const DATASET_SIZE = 100;

    protected const RANDOM_SEED = 0;

    /**
     * @var \Rubix\ML\Datasets\Generators\Agglomerate
     */
    protected $generator;

    /**
     * @var \Rubix\ML\Graph\Trees\ITree
     */
    protected $tree;

    /**
     * @before
     */
    protected function setUp() : void
    {
        $this->generator = new Agglomerate([
            'east' => new Blob([5, -2, -2]),
            'west' => new Blob([0, 5, -3]),
        ], [0.5, 0.5]);

        $this->tree = new ITree();

        srand(self::RANDOM_SEED);
    }

    /**
     * @test
     */
    public function build() : void
    {
        $this->assertInstanceOf(ITree::class, $this->tree);
        $this->assertInstanceOf(BinaryTree::class, $this->tree);
        $this->assertInstanceOf(Tree::class, $this->tree);
    }

    /**
     * @test
     */
    public function growSearch() : void
    {
        $this->tree->grow($this->generator->generate(self::DATASET_SIZE));

        $this->assertGreaterThan(5, $this->tree->height());

        $sample = $this->generator->generate(1)->sample(0);

        $node = $this->tree->search($sample);

        $this->assertInstanceOf(Depth::class, $node);
        $this->assertInstanceOf(BinaryNode::class, $node);
    }

    /**
     * @test
     */
    public function growWithSameSamples() : void
    {
        $generator = new Agglomerate([
            'east' => new Blob([5, -2, 10], 0.0),
        ]);

        $dataset = $generator->generate(self::DATASET_SIZE);

        $this->tree->grow($dataset);

        $this->assertEquals(2, $this->tree->height());
    }

    protected function assertPreConditions() : void
    {
        $this->assertEquals(0, $this->tree->height());
    }
}
