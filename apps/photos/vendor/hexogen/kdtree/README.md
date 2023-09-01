# K-D Tree

[![Latest Version on Packagist][ico-version]][link-packagist]
[![Build Status][ico-tests]][link-tests]
[![Software License][ico-license]](LICENSE.md)
[![Coverage Status][ico-scrutinizer]][link-scrutinizer]
[![Quality Score][ico-code-quality]][link-code-quality]
[![Total Downloads][ico-downloads]][link-downloads]

PHP multidimensional K-D Tree implementation.

To receive all benefits from K-D Tree, use file system implementation(FSKDTree). FSKDTree stores tree in binary format and uses lazy loading while traversing through nodes. Current approach provides much higher performance compared
to deserialization.

## Install

Via Composer

``` bash
$ composer require hexogen/kdtree
```

## Usage

### Tree creation
``` php
//Item container with 2 dimensional points
$itemList = new ItemList(2);

//Adding 2 - dimension items to the list
$itemList->addItem(new Item(1, [1.2, 4.3]));
$itemList->addItem(new Item(2, [1.3, 3.4]));
$itemList->addItem(new Item(3, [4.5, 1.2]));
$itemList->addItem(new Item(4, [5.2, 3.5]));
$itemList->addItem(new Item(5, [2.1, 3.6]));

//Building tree with given item list
$tree = new KDTree($itemList);

```

### Searching nearest items to the given point

``` php
//Creating search engine with custom algorithm (currently Nearest Search)
$searcher = new NearestSearch($tree);

//Retrieving a result ItemInterface[] array with given size (currently 2)
$result = $searcher->search(new Point([1.25, 3.5]), 2);

echo $result[0]->getId(); // 2
echo $result[0]->getNthDimension(0); // 1.3
echo $result[0]->getNthDimension(1); // 3.4

echo $result[1]->getId(); // 1
echo $result[1]->getNthDimension(0); // 1.2
echo $result[1]->getNthDimension(1); // 4.3

```

### Persist tree to a binary file

``` php
//Init tree writer
$persister = new FSTreePersister('/path/to/dir');

//Save the tree to /path/to/dir/treeName.bin
$persister->convert($tree, 'treeName.bin');

```

### File system version of the tree

``` php
//ItemInterface factory
$itemFactory = new ItemFactory();

//Then init new instance of file system version of the tree
$fsTree = new FSKDTree('/path/to/dir/treeName.bin', $itemFactory);

//Now use fs kdtree to search
$fsSearcher = new NearestSearch($fsTree);

//Retrieving a result ItemInterface[] array with given size (currently 2)
$result = $fsSearcher->search(new Point([1.25, 3.5]), 2);

echo $result[0]->getId(); // 2
echo $result[1]->getId(); // 1

```

## Change log

Please see [CHANGELOG](CHANGELOG.md) for more information on what has changed recently.

## Testing

``` bash
$ composer test
```

## Contributing

Please see [CONTRIBUTING](.github/CONTRIBUTING.md) and [CONDUCT](CONDUCT.md) for details.

## Security

If you discover any security related issues, please email volodymyrbas@gmail.com instead of using the issue tracker.

## Credits

- [Volodymyr Basarab][link-author]
- [All Contributors][link-contributors]

## License

The MIT License (MIT). Please see [License File](LICENSE.md) for more information.

[ico-version]: https://img.shields.io/packagist/v/hexogen/kdtree.svg?style=flat-square
[ico-tests]: https://img.shields.io/github/workflow/status/hexogen/kdtree/Tests?label=Tests&style=flat-square
[ico-license]: https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square
[ico-scrutinizer]: https://img.shields.io/scrutinizer/coverage/g/hexogen/kdtree.svg?style=flat-square
[ico-code-quality]: https://img.shields.io/scrutinizer/g/hexogen/kdtree.svg?style=flat-square
[ico-downloads]: https://img.shields.io/packagist/dt/hexogen/kdtree.svg?style=flat-square

[link-packagist]: https://packagist.org/packages/hexogen/kdtree
[link-tests]: https://github.com/hexogen/kdtree/actions?query=workflow%3ATests
[link-scrutinizer]: https://scrutinizer-ci.com/g/hexogen/kdtree/code-structure
[link-code-quality]: https://scrutinizer-ci.com/g/hexogen/kdtree
[link-downloads]: https://packagist.org/packages/hexogen/kdtree
[link-author]: https://github.com/hexogen
[link-contributors]: ../../contributors


<a href="https://github.com/GrahamCampbell/Laravel-Markdown/actions?query=workflow%3ATests"><img src="https://img.shields.io/github/workflow/status/GrahamCampbell/Laravel-Markdown/Tests?label=Tests&style=flat-square" alt="Build Status"></img></a>
