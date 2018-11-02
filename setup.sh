#!/bin/bash

wget https://github.com/SAP/openui5/archive/1.58.5.zip -O archive.zip

unzip -qq archive.zip 

mv ./openui5-1.58.5/src ./src

rm -rf ./openui5-1.58.5