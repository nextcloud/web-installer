<?php

namespace Tensor\Benchmarks\Statistical;

use Tensor\Matrix;

/**
 * @Groups({"Statistical"})
 * @BeforeMethods({"setUp"})
 */
class MatrixQuantileBench
{
    /**
     * @var \Tensor\Matrix
     */
    protected $a;

    public function setUp() : void
    {
        $this->a = Matrix::uniform(500, 500);
    }

    /**
     * @Subject
     * @Iterations(5)
     * @OutputTimeUnit("seconds", precision=3)
     */
    public function quantile() : void
    {
        $this->a->quantile(0.5);
    }
}
