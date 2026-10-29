# git -C BodyParts3D show HEAD:README.md | sed -n '1,8p'  (commit f0eeb6e843380cfe6b83797cf8c3e1af74de5e61)
# BodyParts3D
This repository contains a collection of 3D models of for human anatomy as well as a [Julia language](https://julialang.org/) interface to parse the data. The 3D models are [`stl` files](https://en.wikipedia.org/wiki/STL_%28file_format%29) which have been converted from the original `.obj` files from the [BodyParts3D/Anatomography project](http://lifesciencedb.jp/bp3d/). The data is currently, unfortunately, only for a single male model. More models will be added if these become available. 

The license for the 3D files from the database is: Creative Commons Attribution-Share Alike 2.1 Japan. If you use data from this database, please be sure to attribute this database as follows: "BodyParts3D, (c)  The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan".
http://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html

![Banner image](bannerImage.jpg)


# FMA.csv: filas y IDs únicos
filas de datos: 104723
IDs únicos: 104699

# Con el parser CSV de Python (campos entre comillas con saltos de línea y comas):
# python3 -c "csv.DictReader(FMA.csv)" → 104 721 registros, 104 698 FMAID distintos
# (incluye 3 FMAID malformados en el origen: '', '321383|321383', '321270|Space of ...').
# `cut -d, -f1` da 104 699 porque parte registros con saltos de línea internos.
